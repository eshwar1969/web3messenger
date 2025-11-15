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

  async clearLocalStorage(): Promise<void> {
    try {
      // Clear IndexedDB (used by XMTP for some data)
      if ('indexedDB' in window) {
        const databases = await indexedDB.databases();
        for (const db of databases) {
          if (db.name) {
            indexedDB.deleteDatabase(db.name);
          }
        }
      }

      // Clear OPFS (Origin Private File System) - where XMTP stores its database
      if ('storage' in navigator && 'getDirectory' in navigator.storage) {
        try {
          const root = await navigator.storage.getDirectory();
          // List and remove all files/directories
          for await (const [name] of root.entries()) {
            try {
              await root.removeEntry(name, { recursive: true });
            } catch (e) {
              console.warn(`Could not remove ${name}:`, e);
            }
          }
        } catch (e) {
          console.warn('Could not clear OPFS:', e);
        }
      }

      // Clear localStorage items related to XMTP
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('xmtp') || key.includes('XMTP'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));

      console.log('Local storage cleared successfully');
    } catch (error) {
      console.error('Error clearing local storage:', error);
      throw error;
    }
  }

  async initializeClient(signer: any, env: 'dev' | 'production' = 'dev'): Promise<Client> {
    const xmtpSigner: any = await this.createXmtpSigner(signer);
    this.client = await Client.create(xmtpSigner, { env }) as any;
    return this.client!;
  }

  getClient(): Client | null {
    // If internal client is not set, try to get it from the store
    if (!this.client) {
      try {
        // Try to get client from store if available
        const store = (window as any).__XMTP_STORE__;
        if (store?.getState?.()) {
          const state = store.getState();
          if (state?.xmtpClient) {
            this.client = state.xmtpClient;
            return this.client;
          }
        }
      } catch (e) {
        // Store not available, continue
      }
    }
    return this.client;
  }

  setClient(client: Client | null): void {
    this.client = client;
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
    const client = this.getClient();
    if (!client) throw new Error('XMTP client not initialized');
    try {
      // First, try to get existing DM (like main.js line 1320)
      // This is the proper way to check for existing DMs
      let dm: any = null;
      try {
        dm = await client.conversations.getDmByInboxId(inboxId);
        if (dm) {
          console.log('✅ Existing DM found');
          // Ensure it's marked as DM in multiple ways
          if (!dm.peerInboxId) {
            (dm as any).peerInboxId = inboxId;
          }
          if (!dm.version) {
            (dm as any).version = 'DM';
          }
          
          // Also store in localStorage for persistence
          const { ConversationService } = await import('./conversation.service');
          ConversationService.getInstance().markAsDM(dm.id, inboxId);
          
          return dm;
        }
      } catch (getDmError) {
        // getDmByInboxId might throw if DM doesn't exist, which is fine
        console.log('No existing DM found, creating new one');
      }
      
      // If DM doesn't exist, create a new one
      // In XMTP V3 browser SDK, DMs are created as groups with a single member
      // This matches main.js line 1324: dm = await xmtpClient.conversations.newGroup([inboxId]);
      dm = await client.conversations.newGroup([inboxId]);
      
      // CRITICAL: Sync the conversation to ensure it's properly initialized
      try {
        await dm.sync();
        console.log('✅ DM conversation synced successfully');
      } catch (syncError) {
        console.warn('Could not sync DM conversation immediately:', syncError);
        // Continue anyway - sync will happen when needed
      }
      
      // CRITICAL: Mark it as a DM immediately in multiple ways
      // 1. Set properties on the object
      (dm as any).peerInboxId = inboxId;
      (dm as any).version = 'DM';
      
      // 2. Store in localStorage for persistence (separate from rooms)
      const { ConversationService } = await import('./conversation.service');
      ConversationService.getInstance().markAsDM(dm.id, inboxId);
      
      console.log('DM created and marked as private chat:', { 
        id: dm.id,
        peerInboxId: inboxId, 
        version: 'DM',
        stored: true
      });
      return dm;
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      console.error('Error creating DM:', errorMsg);
      throw error;
    }
  }

  async createGroup(inboxIds: string[]) {
    const client = this.getClient();
    if (!client) throw new Error('XMTP client not initialized');
    return await client.conversations.newGroup(inboxIds);
  }

  async loadConversations() {
    const client = this.getClient();
    if (!client) throw new Error('XMTP client not initialized');
    return await client.conversations.list();
  }

  async streamConversations() {
    const client = this.getClient();
    if (!client) throw new Error('XMTP client not initialized');
    return await client.conversations.stream();
  }

  // Installation management methods - can be used WITHOUT creating a client
  async getInboxState(inboxId: string, env: 'dev' | 'production' = 'dev') {
    try {
      // Use static method to get inbox state without creating a client
      if (typeof (Client as any).inboxStateFromInboxIds === 'function') {
        const inboxStates = await (Client as any).inboxStateFromInboxIds([inboxId], env);
        return inboxStates && inboxStates.length > 0 ? inboxStates[0] : null;
      }
      return null;
    } catch (error) {
      console.error('Error getting inbox state:', error);
      throw error;
    }
  }

  async revokeInstallations(signer: any, inboxId: string, installationBytes: Uint8Array[], env: 'dev' | 'production' = 'dev') {
    try {
      const xmtpSigner = await this.createXmtpSigner(signer);
      
      // Use static method to revoke installations without creating a client
      if (typeof (Client as any).revokeInstallations === 'function') {
        await (Client as any).revokeInstallations(xmtpSigner, inboxId, installationBytes, env);
        return true;
      }
      throw new Error('revokeInstallations method not available');
    } catch (error) {
      console.error('Error revoking installations:', error);
      throw error;
    }
  }

  // Legacy methods (kept for backward compatibility)
  async listInstallations() {
    if (!this.client) throw new Error('XMTP client not initialized');
    const client = this.client as any;
    
    // Try to get installations from the client
    try {
      if (client.installations && typeof client.installations.list === 'function') {
        return await client.installations.list();
      }
      // Alternative: try direct method
      if (typeof client.listInstallations === 'function') {
        return await client.listInstallations();
      }
    } catch (error) {
      console.error('Error listing installations:', error);
    }
    
    return [];
  }

  async revokeInstallation(installationId: string) {
    if (!this.client) throw new Error('XMTP client not initialized');
    const client = this.client as any;
    
    try {
      if (client.installations && typeof client.installations.revoke === 'function') {
        return await client.installations.revoke(installationId);
      }
      // Alternative: try direct method
      if (typeof client.revokeInstallation === 'function') {
        return await client.revokeInstallation(installationId);
      }
    } catch (error) {
      console.error('Error revoking installation:', error);
      throw error;
    }
    
    throw new Error('Revoke installation method not available');
  }
}
