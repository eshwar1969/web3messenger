import { useAppStore, UserProfile } from '../store/useAppStore';

const STORAGE_KEYS = {
  profile: 'xmtpUserProfile',
  friends: 'xmtpFriendDirectory',
  pendingRequests: 'xmtpPendingRequests',
  messageQueue: 'xmtpMessageQueue',
  theme: 'xmtpTheme'
};

export class ProfileService {
  private static instance: ProfileService;

  static getInstance(): ProfileService {
    if (!ProfileService.instance) {
      ProfileService.instance = new ProfileService();
    }
    return ProfileService.instance;
  }

  // Profile Management
  loadUserProfile(): UserProfile {
    if (!window.localStorage) return useAppStore.getState().userProfile;

    try {
      const stored = localStorage.getItem(STORAGE_KEYS.profile);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed.username === 'string') {
          const profile: Partial<UserProfile> = {};
          if (parsed.username) profile.username = parsed.username;
          if (parsed.profilePicture) profile.profilePicture = parsed.profilePicture;
          if (parsed.theme) profile.theme = parsed.theme;
          useAppStore.getState().updateUserProfile(profile);
        }
      }
    } catch (error) {
      console.warn('Unable to load profile from storage', error);
    }

    return useAppStore.getState().userProfile;
  }

  saveUserProfile(): void {
    if (!window.localStorage) return;
    try {
      localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(useAppStore.getState().userProfile));
    } catch (error) {
      console.warn('Unable to persist profile', error);
    }
  }

  normalizeDisplayName(rawName: string): string {
    if (!rawName) return '';
    const trimmed = rawName.trim().replace(/^@+/, '');
    return trimmed;
  }

  normalizeUsername(username: string): string {
    return this.normalizeDisplayName(username);
  }

  validateUsername(username: string): { isValid: boolean; error?: string } {
    const normalized = this.normalizeUsername(username);
    if (!normalized) {
      return { isValid: false, error: 'Username cannot be empty' };
    }
    if (normalized.length < 3 || normalized.length > 32) {
      return { isValid: false, error: 'Username must be between 3 and 32 characters' };
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(normalized)) {
      return { isValid: false, error: 'Username can only include letters, numbers, dots, underscores, or hyphens' };
    }
    return { isValid: true };
  }

  async saveProfile(): Promise<void> {
    this.saveUserProfile();
  }

  setDisplayName(rawName: string): boolean {
    const normalized = this.normalizeDisplayName(rawName);
    if (!normalized) {
      alert('Display name cannot be empty.');
      return false;
    }
    if (normalized.length < 3 || normalized.length > 32) {
      alert('Display name must be between 3 and 32 characters.');
      return false;
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(normalized)) {
      alert('Display name can only include letters, numbers, dots, underscores, or hyphens.');
      return false;
    }

    useAppStore.getState().updateUserProfile({ username: normalized });
    this.saveUserProfile();
    return true;
  }

  async handleProfilePictureUpload(file: File): Promise<void> {
    if (!file) return;

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      alert('Profile picture must be less than 5MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const result = e.target?.result as string;
            if (result) {
              useAppStore.getState().updateUserProfile({ profilePicture: result });
              this.saveUserProfile();
              console.log('Profile picture updated successfully');
              resolve();
            } else {
              reject(new Error('Failed to read file'));
            }
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = (error) => {
          reject(new Error('Failed to read file: ' + error));
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error('Profile picture upload failed:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        reject(new Error('Failed to update profile picture: ' + message));
      }
    });
  }

  // Theme Management
  loadTheme(): void {
    if (!window.localStorage) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.theme);
      if (stored) {
        useAppStore.getState().updateUserProfile({ theme: stored });
        this.applyTheme(stored);
      }
    } catch (error) {
      console.warn('Unable to load theme', error);
    }
  }

  saveTheme(theme: string): void {
    useAppStore.getState().updateUserProfile({ theme });
    if (!window.localStorage) return;
    try {
      localStorage.setItem(STORAGE_KEYS.theme, theme);
    } catch (error) {
      console.warn('Unable to persist theme', error);
    }
    this.applyTheme(theme);
  }

  applyTheme(theme: string): void {
    document.documentElement.setAttribute('data-theme', theme);
  }
}
