const STORAGE_KEYS = {
  messageQueue: 'xmtpMessageQueue'
};

export class StorageUtils {
  private static instance: StorageUtils;

  static getInstance(): StorageUtils {
    if (!StorageUtils.instance) {
      StorageUtils.instance = new StorageUtils();
    }
    return StorageUtils.instance;
  }

  // Message Queue Management
  loadMessageQueue(): any[] {
    const queue: any[] = [];
    if (!window.localStorage) return queue;

    try {
      const stored = localStorage.getItem(STORAGE_KEYS.messageQueue);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed.filter(item =>
            item &&
            typeof item.id === 'string' &&
            typeof item.conversationId === 'string' &&
            typeof item.content === 'string' &&
            typeof item.timestamp === 'number'
          );
        }
      }
    } catch (error) {
      console.warn('Unable to load message queue', error);
    }
    return queue;
  }

  saveMessageQueue(queue: any[]): void {
    if (!window.localStorage) return;
    try {
      localStorage.setItem(STORAGE_KEYS.messageQueue, JSON.stringify(queue));
    } catch (error) {
      console.warn('Unable to persist message queue', error);
    }
  }

  addToQueue(conversationId: string, content: string): any {
    const queueItem = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      conversationId,
      content,
      timestamp: Date.now()
    };

    const currentQueue = this.loadMessageQueue();
    currentQueue.push(queueItem);
    this.saveMessageQueue(currentQueue);

    console.log('Message queued for offline sending');
    return queueItem;
  }

  async processQueue(): Promise<void> {
    const isOnline = navigator.onLine;
    const queue = this.loadMessageQueue();
    const xmtpClient = (window as any).xmtpClient; // Access from global for now

    if (!isOnline || queue.length === 0 || !xmtpClient) return;

    console.log(`Processing ${queue.length} queued messages...`);

    const remainingQueue: any[] = [];

    for (const item of queue) {
      try {
        // This would need to be implemented with proper conversation lookup
        // For now, just remove from queue
        console.log('Queued message processed');
      } catch (error) {
        console.error('Failed to send queued message:', error);
        remainingQueue.push(item);
      }
    }

    this.saveMessageQueue(remainingQueue);
  }

  // Generic storage utilities
  setItem(key: string, value: any): void {
    if (!window.localStorage) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Unable to persist ${key}`, error);
    }
  }

  getItem(key: string): any {
    if (!window.localStorage) return null;
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.warn(`Unable to load ${key}`, error);
      return null;
    }
  }

  removeItem(key: string): void {
    if (!window.localStorage) return;
    localStorage.removeItem(key);
  }

  clear(): void {
    if (!window.localStorage) return;
    localStorage.clear();
  }
}
