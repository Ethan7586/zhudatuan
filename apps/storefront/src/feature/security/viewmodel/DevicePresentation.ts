import { CLIENT_BY_ID } from '@shop/config/clientcatalog';
import type { DeviceSession } from '../model/DeviceSession';

export interface PresentedDevice {
  readonly name: string;
  readonly clientName: string;
  readonly verification: string;
  readonly technical: string;
}

export function presentDevice(device: DeviceSession): PresentedDevice {
  const browser = browserName(device.userAgent);
  const system = systemName(device.userAgent);
  return Object.freeze({
    name: [system, browser].filter(Boolean).join(' · ') || '未知浏览器设备',
    clientName: CLIENT_BY_ID.get(device.client)?.title ?? '智慧翼应用',
    verification: device.assurance >= 3 ? '增强验证' : device.assurance >= 2 ? '已二次验证' : '基础验证',
    technical: device.userAgent.trim() || '浏览器未提供技术信息',
  });
}

export function assuranceName(level: number): string {
  if (level >= 3) return '增强安全验证';
  if (level >= 2) return '已完成二次验证';
  return '基础登录验证';
}

function browserName(agent: string): string {
  if (/MicroMessenger/i.test(agent)) return '微信';
  if (/Edg\//i.test(agent)) return 'Microsoft Edge';
  if (/(Chrome|Chromium)\//i.test(agent)) return 'Google Chrome';
  if (/Firefox\//i.test(agent)) return 'Firefox';
  if (/Safari\//i.test(agent) && !/Chrome\//i.test(agent)) return 'Safari';
  return '';
}

function systemName(agent: string): string {
  if (/(iPhone|iPad|iPod)/i.test(agent)) return 'iPhone 或 iPad';
  if (/Android/i.test(agent)) return 'Android';
  if (/(Macintosh|Mac OS X)/i.test(agent)) return 'macOS';
  if (/Windows/i.test(agent)) return 'Windows';
  if (/Linux/i.test(agent)) return 'Linux';
  return '';
}
