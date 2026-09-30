export type SplitMode = 'equal' | 'amount' | 'percent';
export type SponsorType = 'full' | 'fixed';
export type SettleMode = 'hub' | 'min';

export interface Member {
  id: string;
  name: string;
  color: string;
}

export interface Bill {
  id: string;
  name: string;
  /** VND, integer */
  amount: number;
  payer: string | null;
  parts: string[];
  split: SplitMode;
  /** amount (VND) or percent per member id, depending on `split` */
  custom: Record<string, number>;
  sponsorOn: boolean;
  sponsors: string[];
  sponsorType: SponsorType;
  /** VND each sponsor covers when sponsorType = 'fixed' */
  sponsorAmount: number;
  note: string;
  /** compressed data URL, optional */
  photo: string | null;
}

export interface BankInfo {
  mode: 'upload' | 'auto';
  bin: string;
  acc: string;
  holder: string;
  /** compressed data URL of an uploaded QR screenshot */
  qr: string | null;
}

export interface Party {
  name: string;
  date: string; // yyyy-mm-dd
  icon: string;
  color: string;
  organiser: string | null;
  settleMode: SettleMode;
  members: Member[];
  bills: Bill[];
  bank: Record<string, BankInfo>;
}

/** tx key ("from>to") -> paid */
export type PaidMap = Record<string, boolean>;

export interface Tx {
  from: string;
  to: string;
  amt: number;
}
