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
      // Use the SAME logic as rooms - create empty group and add member
      // This ensures messages are routed correctly and don't echo back
      const group = await this.client.conversations.newGroup([]);
      
      // CRITICAL: Sync the conversation to ensure it's properly initialized
      try {
        await group.sync();
        console.log('✅ DM conversation synced successfully');
      } catch (syncError) {
        console.warn('Could not sync DM conversation immediately:', syncError);
        // Continue anyway - sync will happen when needed
      }
      
      // Add the peer as a member (same as adding members to rooms)
      try {
        await group.addMembers([inboxId]);
        console.log('✅ Peer added to DM conversation');
      } catch (addError) {
        console.warn('Could not add peer to DM:', addError);
        // Continue anyway - member might already be added
      }
      
      // Sync again after adding member to ensure it's updated
      try {
        await group.sync();
        console.log('✅ DM conversation synced after adding member');
      } catch (syncError) {
        console.warn('Could not sync DM conversation after adding member:', syncError);
      }
      
      // CRITICAL: Mark it as a DM immediately in multiple ways
      // 1. Set properties on the object
      (group as any).peerInboxId = inboxId;
      (group as any).version = 'DM';
      
      // 2. Store in localStorage for persistence (separate from rooms)
      const { ConversationService } = await import('./conversation.service');
      ConversationService.getInstance().markAsDM(group.id, inboxId);
      
      console.log('DM created using room logic and marked as private chat:', { 
        id: group.id,
        peerInboxId: inboxId, 
        version: 'DM',
        stored: true
      });
      return group;
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      console.error('Error creating DM:', errorMsg);
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
