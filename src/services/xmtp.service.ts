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
    try {
      return await (this.client as any).getInboxIdByAddress(address);
    } catch (error) {
      console.error('Failed to get inbox ID:', error);
      return null;
    }
  }

  async createDM(inboxId: string) {
    if (!this.client) throw new Error('XMTP client not initialized');
    return await this.client.conversations.getDmByInboxId(inboxId);
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
