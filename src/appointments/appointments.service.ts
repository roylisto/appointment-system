import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment } from './appointment.entity';
import { User } from '../users/user.entity';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Injectable()
export class AppointmentsService {
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
}
