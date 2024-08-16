import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Appointment } from './appointment.entity';
import { User } from '../users/user.entity';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Injectable()
export class AppointmentsService {
  private readonly workHours = { start: 9, end: 18 }; // 9AM to 6PM

  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createAppointmentDto: CreateAppointmentDto): Promise<Appointment> {
    const { userId, ...appointmentData } = createAppointmentDto;

    const user = await this.userRepository.findOneBy({ id: userId });

    if (!user) {
      throw new Error('User not found');
    }

    const appointment = this.appointmentRepository.create({
      ...appointmentData,
      user,
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
      throw new Error('Appointment not found');
    }

    return appointment;
  }

  async update(id: number, updateAppointmentDto: UpdateAppointmentDto): Promise<Appointment> {
    const appointment = await this.findOne(id);

    const { userId, ...appointmentData } = updateAppointmentDto;

    if (userId) {
      const user = await this.userRepository.findOneBy({ id: userId });

      if (!user) {
        throw new Error('User not found');
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
      throw new Error('User not found');
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
      // Check if the current date is a weekday
      if (currentDate.getDay() >= 1 && currentDate.getDay() <= 5) { // Weekdays (Monday to Friday)
        for (let hour = this.workHours.start; hour < this.workHours.end; hour++) {
          for (let minute = 0; minute < 60; minute += 30) { // 30-minute slots
            const slotTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            slots.push({
              date: currentDate.toISOString().split('T')[0],
              time: slotTime,
            });
          }
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
        const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // Add 30 minutes

        // Find the occupied slots for the current date
        const occupiedTimes = transformedAppointments.find(app => app.date === date)?.occupied || [];

        const isOccupied = occupiedTimes.includes(time);

        return {
        ...slot,
        available_slots: isOccupied ? 0 : 1, // Set 0 if occupied, 1 if available
        };
    });

    return availableSlots;
  }

transformAppointments(appointments: Appointment[]): any[] {
    const formatTime = (date: Date): string => date.toISOString().substr(11, 5);

    // Step 1: Group by date
    const groupedByDate: { [key: string]: string[] } = appointments.reduce((acc, appointment) => {
      const date = appointment.startTime.toISOString().substr(0, 10); // 'YYYY-MM-DD'
      const timeSlot = formatTime(appointment.startTime);

      if (!acc[date]) {
        acc[date] = [];
      }

      acc[date].push(timeSlot);

      return acc;
    }, {} as { [key: string]: string[] });

    // Step 2: Format the results
    const result: any[] = Object.keys(groupedByDate).map(date => ({
      date: date,
      occupied: Array.from(new Set(groupedByDate[date])) // Removing duplicates
    }));

    return result;
  }

}
