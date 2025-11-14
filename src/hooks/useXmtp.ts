import { useState, useEffect } from 'react';
import { Client } from '@xmtp/browser-sdk';
import { BrowserProvider } from 'ethers';
import { useAppStore } from '../store/useAppStore';
import { XmtpService } from '../services/xmtp.service';

export const useXmtp = () => {
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    xmtpClient,
    provider,
    signer,
    walletAddress,
    setXmtpClient,
    setProvider,
    setSigner,
    setWalletAddress,
    setIsConnected,
    setError: setStoreError
  } = useAppStore();

  const connectWallet = async () => {
    try {
      setIsInitializing(true);
      setError(null);

      if (!(window as any).ethereum) {
        throw new Error('MetaMask not detected. Please install MetaMask from metamask.io');
      }

      // Dispatch log event
      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: '🦊 Connecting to MetaMask...', type: 'info' }
      }));

      // Connect to MetaMask
      const browserProvider = new BrowserProvider((window as any).ethereum);
      await browserProvider.send("eth_requestAccounts", []);
      const ethersSigner = await browserProvider.getSigner();
      const address = await ethersSigner.getAddress();
      
      // Dispatch success log
      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: `✅ MetaMask connected: ${address}`, type: 'success' }
      }));

      setProvider(browserProvider);
      setSigner(ethersSigner);
      setWalletAddress(address);

      console.log('Initializing XMTP client...');
      
      // Dispatch log event
      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: '🚀 Initializing XMTP V3 client...', type: 'info' }
      }));
      
      const client = await XmtpService.getInstance().initializeClient(ethersSigner, 'dev');

      setXmtpClient(client);
      setIsConnected(true);

      console.log('XMTP client ready!', client.inboxId);
      
      // Dispatch success log
      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: `✅ XMTP V3 client ready! Inbox ID: ${client.inboxId}`, type: 'success' }
      }));

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect';
      setError(errorMessage);
      setStoreError(errorMessage);
      console.error('Connection error:', err);
      
      // Dispatch error log
      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: `❌ Error: ${errorMessage}`, type: 'error' }
      }));
    } finally {
      setIsInitializing(false);
    }
  };

  const disconnect = () => {
    setXmtpClient(null);
    setProvider(null);
    setSigner(null);
    setWalletAddress(null);
    setIsConnected(false);
    setError(null);
  };

  // Listen for account changes
  useEffect(() => {
    if ((window as any).ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          console.log('MetaMask disconnected');
          disconnect();
        } else if (accounts[0] !== walletAddress) {
          console.log('Account changed, reconnecting...');
          disconnect();
          setTimeout(() => connectWallet(), 2000);
        }
      };

      (window as any).ethereum.on('accountsChanged', handleAccountsChanged);

      return () => {
        (window as any).ethereum.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, [walletAddress]);

  return {
    xmtpClient,
    provider,
    signer,
    walletAddress,
    isInitializing,
    error,
    isConnected: !!xmtpClient,
    connectWallet,
    disconnect
  };
};
