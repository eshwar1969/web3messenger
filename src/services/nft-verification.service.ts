import { ethers } from 'ethers';

export interface NFTToken {
  contractAddress: string;
  tokenId: string;
  name: string;
  rank?: string;
  unit?: string;
}

export interface TokenGate {
  contractAddress: string;
  tokenIds?: string[]; // If undefined, any token from contract is valid
  minBalance?: number; // Minimum number of tokens required
}

/**
 * NFT Verification Service for Token-Gated Channels
 * Verifies user's NFT holdings for access control
 */
export class NftVerificationService {
  private static instance: NftVerificationService;
  private provider: ethers.Provider | null = null;

  // Standard ERC721/ERC1155 ABI for balance checking
  private readonly ERC721_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function ownerOf(uint256 tokenId) view returns (address)',
    'function tokenURI(uint256 tokenId) view returns (string)'
  ];

  private readonly ERC1155_ABI = [
    'function balanceOf(address account, uint256 id) view returns (uint256)',
    'function uri(uint256 id) view returns (string)'
  ];

  private constructor() {}

  public static getInstance(): NftVerificationService {
    if (!NftVerificationService.instance) {
      NftVerificationService.instance = new NftVerificationService();
    }
    return NftVerificationService.instance;
  }

  /**
   * Set provider for blockchain queries
   */
  setProvider(provider: ethers.Provider) {
    this.provider = provider;
  }

  /**
   * Check if address owns a specific NFT
   */
  async ownsNFT(
    address: string,
    contractAddress: string,
    tokenId: string,
    isERC1155: boolean = false
  ): Promise<boolean> {
    if (!this.provider) {
      throw new Error('Provider not set');
    }

    try {
      if (isERC1155) {
        const contract = new ethers.Contract(contractAddress, this.ERC1155_ABI, this.provider);
        const balance = await contract.balanceOf(address, tokenId);
        return balance > 0n;
      } else {
        const contract = new ethers.Contract(contractAddress, this.ERC721_ABI, this.provider);
        const owner = await contract.ownerOf(tokenId);
        return owner.toLowerCase() === address.toLowerCase();
      }
    } catch (error) {
      console.error('Error checking NFT ownership:', error);
      return false;
    }
  }

  /**
   * Check if address has any token from a contract
   */
  async hasAnyToken(address: string, contractAddress: string): Promise<boolean> {
    if (!this.provider) {
      throw new Error('Provider not set');
    }

    try {
      const contract = new ethers.Contract(contractAddress, this.ERC721_ABI, this.provider);
      const balance = await contract.balanceOf(address);
      return balance > 0n;
    } catch (error) {
      console.error('Error checking token balance:', error);
      return false;
    }
  }

  /**
   * Get all NFTs owned by address from a specific contract
   */
  async getOwnedTokens(
    address: string,
    contractAddress: string
  ): Promise<NFTToken[]> {
    if (!this.provider) {
      throw new Error('Provider not set');
    }

    // In production, this would use an NFT indexer API or subgraph
    // For demo, we'll return a simplified version
    try {
      const contract = new ethers.Contract(contractAddress, this.ERC721_ABI, this.provider);
      const balance = await contract.balanceOf(address);
      
      // Note: Getting all token IDs requires additional logic or an indexer
      // This is a simplified version
      return [];
    } catch (error) {
      console.error('Error getting owned tokens:', error);
      return [];
    }
  }

  /**
   * Verify if address meets token gate requirements
   */
  async verifyTokenGate(address: string, tokenGate: TokenGate): Promise<boolean> {
    if (!this.provider) {
      throw new Error('Provider not set');
    }

    try {
      // If specific token IDs are required
      if (tokenGate.tokenIds && tokenGate.tokenIds.length > 0) {
        for (const tokenId of tokenGate.tokenIds) {
          const owns = await this.ownsNFT(address, tokenGate.contractAddress, tokenId);
          if (owns) return true;
        }
        return false;
      }

      // If any token from contract is valid
      const hasToken = await this.hasAnyToken(address, tokenGate.contractAddress);
      if (!hasToken) return false;

      // Check minimum balance if required
      if (tokenGate.minBalance !== undefined) {
        const contract = new ethers.Contract(
          tokenGate.contractAddress,
          this.ERC721_ABI,
          this.provider
        );
        const balance = await contract.balanceOf(address);
        return balance >= BigInt(tokenGate.minBalance);
      }

      return true;
    } catch (error) {
      console.error('Error verifying token gate:', error);
      return false;
    }
  }

  /**
   * Get user's rank/unit from their NFT
   * This would parse metadata from the NFT to extract rank/unit information
   */
  async getUserRank(address: string, rankNFTContract: string): Promise<string | null> {
    try {
      const tokens = await this.getOwnedTokens(address, rankNFTContract);
      // In production, would fetch and parse NFT metadata
      // For demo, return null
      return null;
    } catch (error) {
      console.error('Error getting user rank:', error);
      return null;
    }
  }
}

