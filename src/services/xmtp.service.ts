import { Client } from '@xmtp/browser-sdk';
import { BrowserProvider, getBytes } from 'ethers';

export class XmtpService {
  private static instance: XmtpService;
  private client: Client | null = null;

  static getInstance(): XmtpService {
    if (!XmtpService.instance) {
      XmtpService.instance = new XmtpService();
    }
    return XmtpService.instance;
  }

  async createXmtpSigner(ethersSigner: any): Promise<any> {
    return {
      type: 'EOA',
      getIdentifier: async () => {
        const address = await ethersSigner.getAddress();
        return {
          identifier: address.toLowerCase(),
          identifierKind: 'Ethereum'
        };
      },
      signMessage: async (message: string) => {
        const signature = await ethersSigner.signMessage(message);
        return getBytes(signature);
      },
      getChainId: async () => {
        const network = await ethersSigner.provider.getNetwork();
        return Number(network.chainId);
      }
    };
  }

  async initializeClient(signer: any, env: 'dev' | 'production' = 'dev'): Promise<Client> {
    const xmtpSigner: any = await this.createXmtpSigner(signer);
    this.client = await Client.create(xmtpSigner, { env }) as any;
    return this.client!;
  }

  getClient(): Client | null {
    return this.client;
  }

  async getInboxIdByAddress(address: string): Promise<string | null> {
    if (!this.client) throw new Error('XMTP client not initialized');
    
    const client = this.client as any;
    const normalizedAddress = address.toLowerCase();
    
    // Method 1: Try direct call on client (as in original main.js)
    // The method might exist but TypeScript doesn't know about it
    try {
      if (client.getInboxIdByAddress && typeof client.getInboxIdByAddress === 'function') {
        const result = await client.getInboxIdByAddress(normalizedAddress);
        if (result) return result;
      }
    } catch (error: any) {
      // If it's "not a function", try other methods
      if (!error?.message?.includes('not a function')) {
        console.error('getInboxIdByAddress call failed:', error);
      }
    }
    
    // Method 2: Try accessing it without type checking (might be a dynamic method)
    try {
      const result = await (client as any).getInboxIdByAddress?.(normalizedAddress);
      if (result) return result;
    } catch (e) {
      // Ignore
    }
    
    // Method 3: Try through conversations API
    if (client.conversations) {
      try {
        if (typeof client.conversations.getInboxIdByAddress === 'function') {
          const result = await client.conversations.getInboxIdByAddress(normalizedAddress);
          if (result) return result;
        }
      } catch (error) {
        console.error('conversations.getInboxIdByAddress call failed:', error);
      }
    }
    
    // Method 4: Workaround - try creating a DM to get inbox ID
    // This only works if the address is registered
    if (client.conversations && typeof client.conversations.newDm === 'function') {
      try {
        const identifier = {
          identifier: normalizedAddress,
          identifierKind: 'Ethereum' as const
        };
        const dm = await client.conversations.newDm(identifier);
        if (dm && dm.peerInboxId) {
          return dm.peerInboxId;
        }
      } catch (e: any) {
        // This is expected to fail if address not registered
        const errorMsg = e?.message || String(e);
        if (!errorMsg.includes('not registered') && !errorMsg.includes('not found')) {
          console.log('newDm workaround failed:', e);
        }
      }
    }
    
    // Method not available or address not registered
    console.warn('getInboxIdByAddress: Method not available or address not registered on XMTP');
    return null;
  }

  async createDM(inboxId: string) {
    if (!this.client) throw new Error('XMTP client not initialized');
    try {
      const dm = await this.client.conversations.getDmByInboxId(inboxId);
      return dm || null; // Return null if not found instead of undefined
    } catch (error: any) {
      // If DM doesn't exist, return null (caller will create new one)
      const errorMsg = error?.message || String(error);
      if (errorMsg.includes('not found') || errorMsg.includes('does not exist')) {
        return null;
      }
      // Re-throw other errors
      throw error;
    }
  }

  async createGroup(inboxIds: string[]) {
    if (!this.client) throw new Error('XMTP client not initialized');
    return await this.client.conversations.newGroup(inboxIds);
  }

  async loadConversations() {
    if (!this.client) throw new Error('XMTP client not initialized');
    return await this.client.conversations.list();
  }

  async streamConversations() {
    if (!this.client) throw new Error('XMTP client not initialized');
    return await this.client.conversations.stream();
  }
}
