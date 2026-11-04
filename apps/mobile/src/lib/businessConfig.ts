 import { useEffect, useState } from 'react';
import type { UserProfile } from '@turnos/core';
import { TABLES } from '@turnos/models';

import { database } from '../database';
import type { BusinessConfigModel } from '../database/models';

function readTimezone(record: BusinessConfigModel): string | undefined {
  const timezone = record._getRaw('timezone');
  return typeof timezone === 'string' && timezone.trim().length > 0
    ? timezone
    : undefined;
}

/**
 * Lee una vez la zona horaria IANA del negocio (business_config.timezone).
 * Devuelve undefined si el primer pull aún no trajo la fila: quien la consume
 * cae a la zona del dispositivo, que es el comportamiento previo.
 */
export async function getBusinessTimezone(
  profile: UserProfile
): Promise<string | undefined> {
  try {
    const record = await database
      .get<BusinessConfigModel>(TABLES.BUSINESS_CONFIG)
      .find(profile.business_id);
    return readTimezone(record);
  } catch {
    return undefined;
  }
}

/**
 * Observa de forma reactiva la zona horaria del negocio. Emite undefined hasta
 * que el primer pull trae business_config, y se actualiza si la fila cambia.
 */
export function useBusinessTimezone(profile: UserProfile | null): string | undefined {
  const [timezone, setTimezone] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!profile) {
      setTimezone(undefined);
      return;
    }

    let active = true;
    const subscription = database
      .get<BusinessConfigModel>(TABLES.BUSINESS_CONFIG)
      .findAndObserve(profile.business_id)
      .subscribe({
        next: (record) => {
          if (active) {
            setTimezone(record ? readTimezone(record) : undefined);
          }
        },
        error: () => {
          if (active) {
            setTimezone(undefined);
          }
        },
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [profile?.business_id, profile]);

  return timezone;
}
