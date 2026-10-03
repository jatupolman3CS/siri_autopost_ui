// Reference tables that are not data: what each platform is called and drawn as, and the Thai and English
// names of months and weekdays. Hand-maintained (customer data always comes from SIRIAUTOPOST.Api).
import { Platform, PlatformKey } from './models';

export const PLATFORMS: Record<PlatformKey, Platform> = {
  fb: { name: 'Facebook', icon: 'ph-facebook-logo' },
  x: { name: 'X', icon: 'ph-x-logo' },
  ig: { name: 'Instagram', icon: 'ph-instagram-logo' },
  tt: { name: 'TikTok', icon: 'ph-tiktok-logo' },
  line: { name: 'LINE OA', icon: 'ph-chat-circle-dots' },
  th: { name: 'Threads', icon: 'ph-threads-logo' },
};

export const TH_MONTHS = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];
export const TH_MONTHS_FULL = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];
export const EN_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
export const EN_MONTHS_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
export const TH_DAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
export const EN_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
