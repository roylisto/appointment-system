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
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new Error('User not found');
    }

    const appointments = await this.appointmentRepository.find({
      where: {
        user: { id: userId },
        startTime: Between(startDate, endDate),
        endTime: Between(startDate, endDate),
      },
    });

    const slots = this.generateSlots(startDate, endDate);
    const availableSlots = this.calculateAvailableSlots(slots, appointments);

    return availableSlots;
  }

  private generateSlots(startDate: Date, endDate: Date): any[] {
    const slots = [];
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
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
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return slots;
  }

  private calculateAvailableSlots(slots: any[], appointments: Appointment[]): any[] {
    const availableSlots = slots.map(slot => ({ ...slot, available_slots: 1 }));

    appointments.forEach(appointment => {
      const appointmentStart = new Date(appointment.startTime);
      const appointmentEnd = new Date(appointment.endTime);
      const appointmentDate = appointmentStart.toISOString().split('T')[0];
      const appointmentStartTime = appointmentStart.toTimeString().slice(0, 5);
      const appointmentEndTime = appointmentEnd.toTimeString().slice(0, 5);

      availableSlots.forEach(slot => {
        if (slot.date === appointmentDate && slot.time >= appointmentStartTime && slot.time < appointmentEndTime) {
          slot.available_slots = 0;
        }
      });
    });

    return availableSlots;
  }
}
