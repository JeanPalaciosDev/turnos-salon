import { Model } from '@nozbe/watermelondb';
import { TABLES } from '@turnos/models';

/**
 * Las clases registran cada colección en WatermelonDB. Los campos de servicio
 * exponen getters/setters sobre los datos raw para conservar la trazabilidad de
 * cambios de Watermelon sin introducir una configuración de decoradores.
 */
export class BusinessConfigModel extends Model {
  static table = TABLES.BUSINESS_CONFIG;
}

export class UserProfileModel extends Model {
  static table = TABLES.USER_PROFILES;
}

export class ServiceModel extends Model {
  static table = TABLES.SERVICES;

  get businessId(): string {
    return this._getRaw('business_id') as string;
  }

  set businessId(value: string) {
    this._setRaw('business_id', value);
  }

  get name(): string {
    return this._getRaw('name') as string;
  }

  set name(value: string) {
    this._setRaw('name', value);
  }

  get durationMinutes(): number {
    return this._getRaw('duration_minutes') as number;
  }

  set durationMinutes(value: number) {
    this._setRaw('duration_minutes', value);
  }

  get defaultPriceAmount(): number {
    return this._getRaw('default_price_amount') as number;
  }

  set defaultPriceAmount(value: number) {
    this._setRaw('default_price_amount', value);
  }

  get defaultPriceCurrency(): string {
    return this._getRaw('default_price_currency') as string;
  }

  set defaultPriceCurrency(value: string) {
    this._setRaw('default_price_currency', value);
  }

  get isActive(): boolean {
    return this._getRaw('is_active') as boolean;
  }

  set isActive(value: boolean) {
    this._setRaw('is_active', value);
  }

  get updatedAt(): number {
    return this._getRaw('updated_at') as number;
  }

  set updatedAt(value: number) {
    this._setRaw('updated_at', value);
  }

  get syncVersion(): number {
    return this._getRaw('sync_version') as number;
  }

  set syncVersion(value: number) {
    this._setRaw('sync_version', value);
  }

  get isDeleted(): boolean {
    return this._getRaw('is_deleted') as boolean;
  }

  set isDeleted(value: boolean) {
    this._setRaw('is_deleted', value);
  }
}

export class WorkerModel extends Model {
  static table = TABLES.WORKERS;
}

export class ClientModel extends Model {
  static table = TABLES.CLIENTS;

  get businessId(): string {
    return this._getRaw('business_id') as string;
  }

  set businessId(value: string) {
    this._setRaw('business_id', value);
  }

  get name(): string {
    return this._getRaw('name') as string;
  }

  set name(value: string) {
    this._setRaw('name', value);
  }

  get phone(): string | undefined {
    return (this._getRaw('phone') as string | null) ?? undefined;
  }

  set phone(value: string | undefined) {
    this._setRaw('phone', value ?? null);
  }

  get notes(): string | undefined {
    return (this._getRaw('notes') as string | null) ?? undefined;
  }

  set notes(value: string | undefined) {
    this._setRaw('notes', value ?? null);
  }

  get updatedAt(): number {
    return this._getRaw('updated_at') as number;
  }

  set updatedAt(value: number) {
    this._setRaw('updated_at', value);
  }

  get syncVersion(): number {
    return this._getRaw('sync_version') as number;
  }

  set syncVersion(value: number) {
    this._setRaw('sync_version', value);
  }

  get isDeleted(): boolean {
    return this._getRaw('is_deleted') as boolean;
  }

  set isDeleted(value: boolean) {
    this._setRaw('is_deleted', value);
  }
}

export class AppointmentModel extends Model {
  static table = TABLES.APPOINTMENTS;
}

export class PaymentModel extends Model {
  static table = TABLES.PAYMENTS;
}

export const modelClasses = [
  BusinessConfigModel,
  UserProfileModel,
  ServiceModel,
  WorkerModel,
  ClientModel,
  AppointmentModel,
  PaymentModel,
];
