import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentsModule } from './appointments/appointments.module';
import { UsersModule } from './users/users.module';
import config from './orm.config';

@Module({
  imports: [
    TypeOrmModule.forRoot(config),
    AppointmentsModule,
    UsersModule,
],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
