export interface EvolutionInstance {
  instance: {
    instanceName: string;
    state: string;
    profileName?: string;
    profilePictureUrl?: string;
  };
}

export interface EvolutionChat {
  id: string;
  remoteJid: string;
  name?: string;
  lastMessage?: {
    message?: Record<string, unknown>;
    messageTimestamp?: number;
    key?: { fromMe?: boolean };
  };
  updatedAt?: string;
  unreadCount?: number;
}

export interface EvolutionReferral {
  sourceUrl?: string;
  sourceType?: string;
  headline?: string;
  body?: string;
  mediaUrl?: string;
  ctwaClid?: string;
  sourceId?: string;
}

export interface EvolutionMessageKey {
  remoteJid: string;
  fromMe: boolean;
  id: string;
}

export interface EvolutionMessageContextInfo {
  referral?: EvolutionReferral;
  quotedMessage?: Record<string, unknown>;
  stanzaId?: string;
  participant?: string;
}

export interface EvolutionMessage {
  key: EvolutionMessageKey;
  messageTimestamp: number;
  message?: {
    conversation?: string;
    extendedTextMessage?: {
      text?: string;
      contextInfo?: EvolutionMessageContextInfo;
    };
    imageMessage?: {
      caption?: string;
      contextInfo?: EvolutionMessageContextInfo;
    };
    videoMessage?: {
      caption?: string;
      contextInfo?: EvolutionMessageContextInfo;
    };
    buttonsResponseMessage?: {
      selectedDisplayText?: string;
    };
    templateButtonReplyMessage?: {
      selectedDisplayText?: string;
    };
    [key: string]: unknown;
  };
  pushName?: string;
  status?: string;
}

export interface SanitizedMessage {
  id: string;
  remoteJid: string;
  fromMe: boolean;
  timestamp: number;
  messageType: string;
  referral: EvolutionReferral | null;
  hasMedia: boolean;
  textSnippet?: string;
}

export interface EvolutionBusinessProfile {
  profilePictureUrl?: string;
  name?: string;
  description?: string;
  email?: string;
  websites?: string[];
  address?: string;
  category?: string;
  hours?: Record<string, unknown>;
}
