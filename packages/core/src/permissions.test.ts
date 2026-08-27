import { describe, it, expect } from 'vitest';
import {
  canViewAppointment,
  canCreateAppointment,
  canEditAppointment,
  canCancelAppointment,
  canCompleteAppointment,
  canManageServices,
  canManageWorkers,
  canManageClients,
  canViewPayments,
  canRecordPayment,
  canViewCommissions,
  canViewDashboard,
} from './permissions';
import type { UserProfile, Appointment } from './types';

const ownerUser: UserProfile = {
  id: 'u-owner',
  business_id: 'b1',
  role: 'owner',
  worker_id: undefined,
  email: 'owner@salon.test',
  updated_at: 0,
  sync_version: 0,
};

const workerUser: UserProfile = {
  id: 'u-worker',
  business_id: 'b1',
  role: 'worker',
  worker_id: 'w1',
  email: 'worker@salon.test',
  updated_at: 0,
  sync_version: 0,
};

const appointmentDeW1: Appointment = {
  id: 'a1',
  business_id: 'b1',
  date: '2025-03-15',
  start_time: '10:00',
  end_time: '10:30',
  status: 'scheduled',
  service_id: 's1',
  worker_id: 'w1',
  client_id: 'c1',
  updated_at: 0,
  sync_version: 0,
  is_deleted: false,
};

const appointmentDeOtro: Appointment = {
  ...appointmentDeW1,
  id: 'a2',
  worker_id: 'w2',
};

describe('canViewAppointment', () => {
  it('el owner puede ver cualquier turno', () => {
    expect(canViewAppointment(ownerUser, appointmentDeW1)).toBe(true);
    expect(canViewAppointment(ownerUser, appointmentDeOtro)).toBe(true);
  });

  it('el worker puede ver sus propios turnos (worker_id coincide)', () => {
    expect(canViewAppointment(workerUser, appointmentDeW1)).toBe(true);
  });

  it('el worker NO puede ver turnos de otro (worker_id distinto)', () => {
    expect(canViewAppointment(workerUser, appointmentDeOtro)).toBe(false);
  });
});

describe('canCompleteAppointment', () => {
  it('el owner puede completar cualquier turno', () => {
    expect(canCompleteAppointment(ownerUser, appointmentDeW1)).toBe(true);
    expect(canCompleteAppointment(ownerUser, appointmentDeOtro)).toBe(true);
  });

  it('el worker puede completar sus propios turnos (worker_id coincide)', () => {
    expect(canCompleteAppointment(workerUser, appointmentDeW1)).toBe(true);
  });

  it('el worker NO puede completar turnos de otro (worker_id distinto)', () => {
    expect(canCompleteAppointment(workerUser, appointmentDeOtro)).toBe(false);
  });
});

describe('permisos owner-only', () => {
  it('canCreateAppointment: owner sí, worker no', () => {
    expect(canCreateAppointment(ownerUser)).toBe(true);
    expect(canCreateAppointment(workerUser)).toBe(false);
  });

  it('canEditAppointment: owner sí, worker no (ignora el appointment)', () => {
    expect(canEditAppointment(ownerUser, appointmentDeW1)).toBe(true);
    expect(canEditAppointment(workerUser, appointmentDeW1)).toBe(false);
    // aun tratándose de su propio turno, el worker no puede editar
    expect(canEditAppointment(workerUser, appointmentDeOtro)).toBe(false);
  });

  it('canCancelAppointment: owner sí, worker no (ignora el appointment)', () => {
    expect(canCancelAppointment(ownerUser, appointmentDeW1)).toBe(true);
    expect(canCancelAppointment(workerUser, appointmentDeW1)).toBe(false);
    // aun tratándose de su propio turno, el worker no puede cancelar
    expect(canCancelAppointment(workerUser, appointmentDeOtro)).toBe(false);
  });

  it('canManageServices: owner sí, worker no', () => {
    expect(canManageServices(ownerUser)).toBe(true);
    expect(canManageServices(workerUser)).toBe(false);
  });

  it('canManageWorkers: owner sí, worker no', () => {
    expect(canManageWorkers(ownerUser)).toBe(true);
    expect(canManageWorkers(workerUser)).toBe(false);
  });

  it('canManageClients: owner sí, worker no', () => {
    expect(canManageClients(ownerUser)).toBe(true);
    expect(canManageClients(workerUser)).toBe(false);
  });

  it('canViewPayments: owner sí, worker no', () => {
    expect(canViewPayments(ownerUser)).toBe(true);
    expect(canViewPayments(workerUser)).toBe(false);
  });

  it('canRecordPayment: owner sí, worker no', () => {
    expect(canRecordPayment(ownerUser)).toBe(true);
    expect(canRecordPayment(workerUser)).toBe(false);
  });

  it('canViewCommissions: owner sí, worker no', () => {
    expect(canViewCommissions(ownerUser)).toBe(true);
    expect(canViewCommissions(workerUser)).toBe(false);
  });

  it('canViewDashboard: owner sí, worker no', () => {
    expect(canViewDashboard(ownerUser)).toBe(true);
    expect(canViewDashboard(workerUser)).toBe(false);
  });
});
