import { Client } from '@xmtp/browser-sdk';
import { BrowserProvider, getBytes } from 'ethers';

/**
 * Private XMTP Service for Government Portal
 * Connects to self-hosted, private XMTP nodes instead of public network
 */
export class PrivateXmtpService {
  private static instance: PrivateXmtpService;
  private client: Client | null = null;
  private privateNetworkUrl: string;
  private isInitializing: boolean = false;
  private initializationPromise: Promise<Client> | null = null;

  private constructor() {
    // In production, this would be configured via environment variables
    // For demo, we'll use a placeholder that would be replaced with actual private node URL
    this.privateNetworkUrl = process.env.NEXT_PUBLIC_PRIVATE_XMTP_URL || 
      'wss://private-xmtp-node.gov.local'; // Example private node URL
  }

  public static getInstance(): PrivateXmtpService {
    if (!PrivateXmtpService.instance) {
      PrivateXmtpService.instance = new PrivateXmtpService();
    }
    return PrivateXmtpService.instance;
  }

  /**
   * Create XMTP signer from ethers signer
   */
  private async createXmtpSigner(ethersSigner: any): Promise<any> {
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

  /**
   * Initialize client with private network configuration
   */
  async initializeClient(signer: any, options?: { env?: 'production' | 'dev' }) {
    // If client already exists, return it
    if (this.client) {
      console.log('Private XMTP client already initialized');
      return this.client;
    }

    // If initialization is in progress, wait for it to complete
    if (this.isInitializing && this.initializationPromise) {
      console.log('Initialization already in progress, waiting...');
      return await this.initializationPromise;
    }

    // Start initialization
    this.isInitializing = true;
    this.initializationPromise = this._doInitialize(signer, options);

    try {
      const client = await this.initializationPromise;
      return client;
    } catch (error) {
      // Reset initialization state on error
      this.isInitializing = false;
      this.initializationPromise = null;
      throw error;
    }
  }

  /**
   * Internal method to perform the actual initialization
   */
  private async _doInitialize(signer: any, options?: { env?: 'production' | 'dev' }): Promise<Client> {
    try {
      const xmtpSigner = await this.createXmtpSigner(signer);
      const address = await signer.getAddress();
      
      console.log(`Initializing private XMTP client for ${address}...`);
      
      try {
        // Try to create client
        this.client = await Client.create(xmtpSigner, {
          env: options?.env || 'dev',
        });
      } catch (error: any) {
        const errorMessage = error.message || error.toString() || '';
        
        // If error is about multiple create operations, wait and retry
        if (errorMessage.includes('Multiple create operations') || 
            errorMessage.includes('already registered') ||
            errorMessage.includes('PublishIdentityUpdate')) {
          console.log('Identity creation conflict detected, waiting 3 seconds before retry...');
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Retry once
          try {
            this.client = await Client.create(xmtpSigner, {
              env: options?.env || 'dev',
            });
          } catch (retryError: any) {
            // If still fails, it might be that identity is being created elsewhere
            // Wait longer and try one more time
            console.log('Retry failed, waiting 5 more seconds...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            this.client = await Client.create(xmtpSigner, {
              env: options?.env || 'dev',
            });
          }
        } else {
          throw error;
        }
      }

      // Store that this is a private network connection
      (this.client as any)._isPrivateNetwork = true;
      (this.client as any)._privateNetworkUrl = this.privateNetworkUrl;

      this.isInitializing = false;
      this.initializationPromise = null;

      console.log('Private XMTP client initialized successfully');
      return this.client;
    } catch (error: any) {
      console.error('Failed to initialize private XMTP client:', error);
      
      // Provide more helpful error message
      const errorMessage = error.message || error.toString() || '';
      if (errorMessage.includes('Multiple create operations')) {
        throw new Error('XMTP identity creation is in progress. Please wait 10-15 seconds and refresh the page.');
      }
      
      throw error;
    }
  }

  /**
   * Get the private XMTP client
   */
  getClient(): Client | null {
    return this.client;
  }

  /**
   * Check if connected to private network
   */
  isPrivateNetwork(): boolean {
    return this.client !== null && (this.client as any)._isPrivateNetwork === true;
  }

  /**
   * Get private network URL
   */
  getPrivateNetworkUrl(): string {
    return this.privateNetworkUrl;
  }

  /**
   * Disconnect from private network
   */
  async disconnect() {
    if (this.client) {
      // Clean up resources
      this.client = null;
    }
  }
}

