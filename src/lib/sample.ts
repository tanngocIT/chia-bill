import type { Party } from './types';

export const AVATAR_COLORS = ['#002a61', '#9e0202', '#315e00', '#6b3fa0', '#623b02', '#0b36d2', '#0045a5', '#41474e'];

export const THEME_COLORS = [
  { hex: '#3c66ff', label: 'Xanh dương' },
  { hex: '#002a61', label: 'Xanh navy' },
  { hex: '#315e00', label: 'Xanh lá' },
  { hex: '#0045a5', label: 'Xanh biển' },
  { hex: '#623b02', label: 'Nâu' },
  { hex: '#9e0202', label: 'Đỏ' },
];

export function emptyParty(): Party {
  return {
    name: '',
    date: new Date().toISOString().slice(0, 10),
    icon: 'food',
    color: '#3c66ff',
    organiser: null,
    settleMode: 'hub',
    members: [],
    bills: [],
    bank: {},
  };
}

export function sampleParty(): Party {
  const all = ['m1', 'm2', 'm3', 'm4', 'm5'];
  return {
    name: 'Cuối tuần Vũng Tàu',
    date: '2026-09-26',
    icon: 'beach',
    color: '#3c66ff',
    organiser: 'm3',
    settleMode: 'hub',
    members: [
      { id: 'm1', name: 'Tuấn', color: AVATAR_COLORS[0] },
      { id: 'm2', name: 'Linh', color: AVATAR_COLORS[1] },
      { id: 'm3', name: 'Minh', color: AVATAR_COLORS[2] },
      { id: 'm4', name: 'Hà', color: AVATAR_COLORS[3] },
      { id: 'm5', name: 'Khoa', color: AVATAR_COLORS[4] },
    ],
    bills: [
      { id: 'b1', name: 'Lẩu hải sản', amount: 1850000, payer: 'm3', parts: all.slice(), split: 'equal', custom: {}, sponsorOn: true, sponsors: ['m1'], sponsorType: 'full', sponsorAmount: 0, note: 'Tối thứ Bảy, quán ven biển', photo: null },
      { id: 'b2', name: 'Karaoke', amount: 1200000, payer: 'm4', parts: all.slice(), split: 'equal', custom: {}, sponsorOn: true, sponsors: ['m1'], sponsorType: 'fixed', sponsorAmount: 500000, note: '', photo: null },
      { id: 'b3', name: 'Taxi về khách sạn', amount: 350000, payer: 'm5', parts: ['m2', 'm4', 'm5'], split: 'equal', custom: {}, sponsorOn: false, sponsors: [], sponsorType: 'full', sponsorAmount: 0, note: 'Chỉ 3 người về sớm', photo: null },
    ],
    bank: {
      m3: { mode: 'upload', bin: '970436', acc: '0123456789', holder: 'NGUYEN VAN MINH', qr: null },
    },
  };
}
