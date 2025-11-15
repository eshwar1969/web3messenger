export class NotificationService {
  private static instance: NotificationService;
  private permissionGranted: boolean = false;
  private currentConversationId: string | null = null;

  private constructor() {
    // Check if notifications are supported
    if ('Notification' in window) {
      // Check current permission status
      if (Notification.permission === 'granted') {
        this.permissionGranted = true;
      } else if (Notification.permission === 'default') {
        // Request permission when service is first used
        this.requestPermission();
      }
    }
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Request notification permission from the user
   */
  public async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('Notifications are not supported in this browser');
      return false;
    }

    if (Notification.permission === 'granted') {
      this.permissionGranted = true;
      return true;
    }

    if (Notification.permission === 'denied') {
      console.warn('Notification permission was denied');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permissionGranted = permission === 'granted';
      return this.permissionGranted;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  /**
   * Set the current conversation ID (to avoid showing notifications for active conversation)
   */
  public setCurrentConversation(conversationId: string | null): void {
    this.currentConversationId = conversationId;
  }

  /**
   * Show a notification for a new message
   */
  public async showMessageNotification(
    conversationName: string,
    messageContent: string,
    conversationId: string,
    isDM: boolean = false
  ): Promise<void> {
    // Don't show notification if user is viewing this conversation
    if (this.currentConversationId === conversationId) {
      return;
    }

    // Don't show notification if permission not granted
    if (!this.permissionGranted) {
      // Try to request permission again
      const granted = await this.requestPermission();
      if (!granted) {
        return;
      }
    }

    // Check if document is visible (don't notify if tab is active)
    if (document.visibilityState === 'visible') {
      // Still show notification but maybe with less urgency
      // You can customize this behavior
    }

    try {
      // Truncate message content for notification
      const truncatedContent = messageContent.length > 100 
        ? messageContent.substring(0, 100) + '...' 
        : messageContent;

      // Format notification title
      const title = isDM ? `💬 DM: ${conversationName}` : `🏠 Room: ${conversationName}`;

      // Create notification
      const notification = new Notification(title, {
        body: truncatedContent,
        icon: '/favicon.ico', // You can add a custom icon
        badge: '/favicon.ico',
        tag: conversationId, // Group notifications by conversation
        requireInteraction: false,
        silent: false
      });

      // Auto-close notification after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

      // Handle notification click - focus the window
      notification.onclick = () => {
        window.focus();
        notification.close();
        // Dispatch event to switch to this conversation
        window.dispatchEvent(new CustomEvent('notification-click', {
          detail: { conversationId }
        }));
      };

    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }

  /**
   * Show a notification for a new conversation
   */
  public async showConversationNotification(
    conversationName: string,
    conversationId: string,
    isDM: boolean = false
  ): Promise<void> {
    if (!this.permissionGranted) {
      const granted = await this.requestPermission();
      if (!granted) {
        return;
      }
    }

    try {
      const title = isDM ? `💬 New DM: ${conversationName}` : `🏠 New Room: ${conversationName}`;
      const body = isDM 
        ? `You have a new direct message from ${conversationName}`
        : `You've been added to ${conversationName}`;

      const notification = new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: conversationId,
        requireInteraction: false,
        silent: false
      });

      setTimeout(() => {
        notification.close();
      }, 5000);

      notification.onclick = () => {
        window.focus();
        notification.close();
        window.dispatchEvent(new CustomEvent('notification-click', {
          detail: { conversationId }
        }));
      };

    } catch (error) {
      console.error('Error showing conversation notification:', error);
    }
  }

  /**
   * Close all notifications for a specific conversation
   */
  public closeNotifications(conversationId: string): void {
    // Notifications with the same tag are automatically replaced
    // This is handled by the browser
  }
}

