import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Appointment } from './appointment.entity';
import { User } from '../users/user.entity';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AppointmentsService {
    private readonly workHours: { start: number; end: number };
    private readonly slotDuration: number;
    private readonly maxSlotsPerAppointment: number;
    private readonly operationalDays: number[];

    constructor(
        @InjectRepository(Appointment)
        private readonly appointmentRepository: Repository<Appointment>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
    ) {
        const configPath = path.resolve(__dirname, '../../appointment-config.json');
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

        this.workHours = config.workHours;
        this.slotDuration = config.slotDuration;
        this.maxSlotsPerAppointment = config.maxSlotsPerAppointment;
        this.operationalDays = config.operationalDays;
    }

    async create(createAppointmentDto: CreateAppointmentDto): Promise<Appointment> {
        const { userId, startTime, endTime, ...appointmentData } = createAppointmentDto;

        const user = await this.userRepository.findOneBy({ id: userId });

        if (!user) {
            throw new BadRequestException('User not found');
        }

        // Validate appointment times
        if (!this.isValidSlot(new Date(startTime), new Date(endTime))) {
            throw new BadRequestException(`Appointment times must align with ${this.slotDuration}-minute intervals`);
        }

        // Check for overlapping appointments
        const conflictingAppointment = await this.appointmentRepository.findOne({
        where: {
            user: { id: userId },
            startTime: Between(new Date(startTime), new Date(endTime)),
            endTime: Between(new Date(startTime), new Date(endTime)),
        },
        });

        if (conflictingAppointment) {
            throw new BadRequestException('Appointment slot is already booked');
        }

        // Ensure startTime and endTime are included
        const appointment = this.appointmentRepository.create({
        ...appointmentData,
        user,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        });

        return await this.appointmentRepository.save(appointment);
    }


  async findAll(): Promise<Appointment[]> {
    return await this.appointmentRepository.find({ relations: ['user'] });
  }

  async findOne(id: number): Promise<Appointment> {
    const appointment = await this.appointmentRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!appointment) {
        throw new BadRequestException('Appointment not found');
    }

    return appointment;
  }

  async update(id: number, updateAppointmentDto: UpdateAppointmentDto): Promise<Appointment> {
    const appointment = await this.findOne(id);

    const { userId, ...appointmentData } = updateAppointmentDto;

    if (userId) {
      const user = await this.userRepository.findOneBy({ id: userId });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      appointment.user = user;
    }

    Object.assign(appointment, appointmentData);
    return await this.appointmentRepository.save(appointment);
  }

  async remove(id: number): Promise<void> {
    const appointment = await this.findOne(id);
    await this.appointmentRepository.remove(appointment);
  }

  //
  async getAvailableSlots(userId: number, startDate: Date, endDate: Date): Promise<any[]> {
    // Validate user
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
        throw new BadRequestException('User not found');
    }

    const startOfDay = new Date(startDate);
    startOfDay.setHours(0, 0, 0, 0); // Set to 00:00:00

    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999); // Set to 23:59:59.999

    const appointments = await this.appointmentRepository.find({
      where: {
        user: { id: userId },
        startTime: Between(startOfDay, endOfDay),
        endTime: Between(startOfDay, endOfDay),
      },
    });

    const slots = this.generateSlots(startDate, endDate);
    const availableSlots = this.calculateAvailableSlots(slots, appointments);

    return availableSlots;
  }

    private generateSlots(startDate: Date, endDate: Date): any[] {
        const slots = [];
        let currentDate = new Date(startDate);

        // Generate slots for the specific date range
        while (currentDate <= endDate) {
            if (this.operationalDays.includes(currentDate.getDay())) {
                let currentTime = new Date(currentDate);
                currentTime.setHours(this.workHours.start, 0, 0, 0); // Set to start of work day

                // Generate slots within operational hours for the current date
                while (currentTime.getHours() < this.workHours.end) {
                    const timeStart = `${currentTime.getHours().toString().padStart(2, '0')}:${currentTime.getMinutes().toString().padStart(2, '0')}`;
                    const timeEnd = new Date(currentTime.getTime() + this.slotDuration * 60 * 1000);
                    const timeEndString = `${timeEnd.getHours().toString().padStart(2, '0')}:${timeEnd.getMinutes().toString().padStart(2, '0')}`;

                    // Check if the end time is within work hours
                    if (timeEnd.getHours() < this.workHours.end ||
                        (timeEnd.getHours() === this.workHours.end && timeEnd.getMinutes() === 0)) {
                        slots.push({
                            date: currentDate.toISOString().split('T')[0],
                            time: timeStart,
                            time_end: timeEndString
                        });
                    }

                    // Move to the next slot start time
                    currentTime = timeEnd;
                }
            }
            // Move to the next day
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return slots;
    }

  calculateAvailableSlots(slots: any[], appointments: Appointment[]): any[] {
    const transformedAppointments = this.transformAppointments(appointments);

    const availableSlots = slots.map(slot => {
        const { date, time } = slot;
        const startTime = new Date(`${date}T${time}:00`);
        const endTime = new Date(startTime.getTime() + this.slotDuration * 60 * 1000); // Adjust based on slot duration

        // Find the occupied slots for the current date
        const occupiedSlots = transformedAppointments.find(app => app.date === date)?.occupied || [];

        // Check if the current slot's time falls within any occupied slot's range
        const isOccupied = occupiedSlots.some(occupied => {
            const occupiedStart = new Date(`${date}T${occupied.time_start}:00`);
            const occupiedEnd = new Date(`${date}T${occupied.time_end}:00`);
            return (startTime < occupiedEnd && endTime > occupiedStart); // Check overlap
        });

        return {
            ...slot,
            available_slots: isOccupied ? 0 : 1, // Set 0 if occupied, 1 if available
        };
    });

    return availableSlots;
}

transformAppointments(appointments: Appointment[]): any[] {
    const formatTime = (date: Date): string => date.toISOString().substr(11, 5);

    const groupedByDate: { [key: string]: { time_start: string, time_end: string }[] } = appointments.reduce((acc, appointment) => {
        const date = appointment.startTime.toISOString().substr(0, 10); // 'YYYY-MM-DD'
        const timeStart = formatTime(appointment.startTime);
        const timeEnd = formatTime(appointment.endTime);

        if (!acc[date]) {
            acc[date] = [];
        }

        acc[date].push({ time_start: timeStart, time_end: timeEnd });

        return acc;
    }, {} as { [key: string]: { time_start: string, time_end: string }[] });

    // Removing duplicates
    const result: any[] = Object.keys(groupedByDate).map(date => ({
        date: date,
        occupied: Array.from(new Set(groupedByDate[date].map(slot => JSON.stringify(slot))))
            .map(slot => JSON.parse(slot))
    }));

    return result;
}



    private isValidSlot(startTime: Date, endTime: Date): boolean {
        if (!(startTime instanceof Date) || !(endTime instanceof Date)) {
            throw new Error('startTime and endTime must be Date objects');
        }

        const slotDurationMs = this.slotDuration * 60 * 1000;
        const diff = endTime.getTime() - startTime.getTime();

        return diff === slotDurationMs && startTime.getMinutes() % this.slotDuration === 0;
    }

}
