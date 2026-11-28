import { after } from 'next/server';
import { maintainDuringTraffic } from '@/lib/db-maintenance';

export function scheduleDatabaseMaintenance() {
  after(maintainDuringTraffic);
}
