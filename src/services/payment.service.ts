import { BrowserProvider } from 'ethers';

/**
 * Payment Service for Web3 Wallet Transactions
 * Handles sending and receiving payments via wallet addresses
 */
export class PaymentService {
  private static instance: PaymentService;

  private constructor() {}

  public static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  /**
   * Send payment to a wallet address
   */
  async sendPayment(
    recipientAddress: string,
    amount: string,
    provider: BrowserProvider
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (!provider) {
        throw new Error('Wallet provider not available');
      }

      // Validate recipient address
      if (!/^0x[a-fA-F0-9]{40}$/i.test(recipientAddress)) {
        throw new Error('Invalid recipient address');
      }

      // Validate amount
      const amountWei = parseFloat(amount);
      if (isNaN(amountWei) || amountWei <= 0) {
        throw new Error('Invalid amount');
      }

      // Get signer
      const signer = await provider.getSigner();
      const senderAddress = await signer.getAddress();

      if (senderAddress.toLowerCase() === recipientAddress.toLowerCase()) {
        throw new Error('Cannot send payment to yourself');
      }

      // Convert amount to wei (assuming ETH, adjust for other tokens)
      const amountInWei = BigInt(Math.floor(amountWei * 1e18));

      // Send transaction
      const tx = await signer.sendTransaction({
        to: recipientAddress,
        value: amountInWei,
      });

      // Wait for transaction to be mined
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt?.hash || tx.hash,
      };
    } catch (error: any) {
      console.error('Payment error:', error);
      return {
        success: false,
        error: error.message || 'Failed to send payment',
      };
    }
  }

  /**
   * Get wallet balance
   */
  async getBalance(address: string, provider: BrowserProvider): Promise<string> {
    try {
      const balance = await provider.getBalance(address);
      // Convert from wei to ETH
      const balanceInEth = Number(balance) / 1e18;
      return balanceInEth.toFixed(6);
    } catch (error) {
      console.error('Error getting balance:', error);
      return '0.000000';
    }
  }

  /**
   * Get recipient address from conversation
   * For DMs, we need to get the peer's wallet address from their inbox ID
   */
  async getRecipientAddress(
    conversation: any,
    xmtpClient: any
  ): Promise<string | null> {
    try {
      // For DM conversations, get the peer's inbox ID
      if (conversation.version === 'DM') {
        const currentUserInboxId = xmtpClient?.inboxId;
        const memberIds = conversation.memberInboxIds || [];
        
        // Find the peer's inbox ID (not the current user)
        const peerInboxId = memberIds.find(
          (id: string) => id !== currentUserInboxId
        ) || conversation.peerInboxId;

        if (!peerInboxId) {
          return null;
        }

        // Try to get wallet address from inbox ID
        // Note: This might not always work, as inbox ID doesn't directly map to wallet address
        // In a real implementation, you might need to store wallet addresses separately
        // or use a reverse lookup service
        
        // For now, we'll try to get it from XMTP service
        try {
          const { XmtpService } = await import('./xmtp.service');
          const xmtpService = XmtpService.getInstance();
          
          // Try to get address from inbox ID (this might not be available)
          // As a workaround, we can prompt the user to enter the address
          // or store it when the conversation is created
          
          return null; // Will need user input or stored address
        } catch (e) {
          return null;
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting recipient address:', error);
      return null;
    }
  }

  /**
   * Format transaction hash for display
   */
  formatTxHash(txHash: string): string {
    if (!txHash) return '';
    return `${txHash.slice(0, 10)}...${txHash.slice(-8)}`;
  }

  /**
   * Get transaction explorer URL
   */
  getExplorerUrl(txHash: string, chainId?: number): string {
    // Default to Ethereum mainnet
    const explorerBase = chainId === 11155111 
      ? 'https://sepolia.etherscan.io' 
      : 'https://etherscan.io';
    return `${explorerBase}/tx/${txHash}`;
  }
}

