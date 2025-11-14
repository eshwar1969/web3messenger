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
      const errorString = err instanceof Error ? err.toString() : String(err);
      let displayError = errorMessage;
      
      // Check if it's an installation limit error
      if ((errorMessage.includes('already registered') || errorMessage.includes('installations')) && 
          (errorMessage.includes('10/10') || errorMessage.includes('10') || errorString.includes('InboxID'))) {
        // Try to extract inbox ID from the full error
        const inboxIdMatch = errorString.match(/InboxID\s+([a-f0-9]{64})/i) || 
                            errorMessage.match(/InboxID\s+([a-f0-9]{64})/i);
        const inboxId = inboxIdMatch ? inboxIdMatch[1] : null;
        
        // Store the full error with inbox ID for later use
        const fullError = inboxId ? `${errorMessage} (InboxID: ${inboxId})` : errorMessage;
        displayError = 'Installation limit reached. You have 10/10 installations registered. Please revoke old installations to create a new one.' + 
                      (inboxId ? `\n\nYour Inbox ID: ${inboxId}` : '');
        
        // Store the inbox ID in a way that ConnectPage can access it
        if (inboxId) {
          sessionStorage.setItem('xmtp_inbox_id', inboxId);
        }
      }
      
      setError(displayError);
      setStoreError(displayError);
      console.error('Connection error:', err);
      console.error('Full error string:', errorString);
      
      // Dispatch error log
      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: `❌ Error: ${displayError}`, type: 'error' }
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
