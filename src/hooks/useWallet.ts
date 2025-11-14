import { useState, useEffect } from 'react';
import { BrowserProvider } from 'ethers';
import { useAppStore } from '../store/useAppStore';

export const useWallet = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    provider,
    signer,
    walletAddress,
    setProvider,
    setSigner,
    setWalletAddress
  } = useAppStore();

  const connect = async () => {
    try {
      setIsConnecting(true);
      setError(null);

      if (!(window as any).ethereum) {
        throw new Error('MetaMask not detected. Please install MetaMask from metamask.io');
      }

      const browserProvider = new BrowserProvider((window as any).ethereum);
      await browserProvider.send("eth_requestAccounts", []);
      const ethersSigner = await browserProvider.getSigner();
      const address = await ethersSigner.getAddress();

      setProvider(browserProvider);
      setSigner(ethersSigner);
      setWalletAddress(address);

      console.log('MetaMask connected:', address);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect wallet';
      setError(errorMessage);
      console.error('Wallet connection error:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setProvider(null);
    setSigner(null);
    setWalletAddress(null);
    setError(null);
  };

  // Listen for account changes
  useEffect(() => {
    if ((window as any).ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          console.log('Wallet disconnected');
          disconnect();
        } else if (accounts[0] !== walletAddress) {
          console.log('Account changed');
          setWalletAddress(accounts[0]);
        }
      };

      const handleChainChanged = () => {
        // Reload the page on chain change
        window.location.reload();
      };

      (window as any).ethereum.on('accountsChanged', handleAccountsChanged);
      (window as any).ethereum.on('chainChanged', handleChainChanged);

      return () => {
        (window as any).ethereum.removeListener('accountsChanged', handleAccountsChanged);
        (window as any).ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, [walletAddress, setWalletAddress]);

  return {
    provider,
    signer,
    walletAddress,
    isConnecting,
    error,
    isConnected: !!walletAddress,
    connect,
    disconnect
  };
};
