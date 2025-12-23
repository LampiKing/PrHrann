import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';

const GUEST_STORAGE_KEY = '@PrHran:guestViewData';

interface GuestViewData {
  deviceId: string;
  viewCount: number;
  lastViewTime: number;
  productViewed: string | null;
}

/**
 * Get unique device identifier for guest mode tracking
 */
async function getDeviceId(): Promise<string> {
  try {
    // Try to get existing device ID from storage
    const storedId = await AsyncStorage.getItem('@PrHran:deviceId');
    if (storedId) return storedId;
    
    // Generate new ID from device info
    const deviceInfo = [
      Device.modelName || 'unknown',
      Device.brand || 'unknown',
      Device.osName || 'unknown',
      Device.osVersion || 'unknown',
      Device.deviceType?.toString() || 'unknown',
      Device.platformApiLevel?.toString() || 'unknown',
    ].join('-');
    
    // Add random component to ensure uniqueness
    const randomId = Math.random().toString(36).substring(2, 15);
    const deviceId = `${deviceInfo}-${randomId}`;
    
    // Store for future use
    await AsyncStorage.setItem('@PrHran:deviceId', deviceId);
    return deviceId;
  } catch (error) {
    console.error('Error getting device ID:', error);
    // Fallback to random ID
    return Math.random().toString(36).substring(2, 15);
  }
}

/**
 * Get guest view data from storage
 */
async function getGuestData(): Promise<GuestViewData | null> {
  try {
    const data = await AsyncStorage.getItem(GUEST_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error reading guest data:', error);
    return null;
  }
}

/**
 * Save guest view data to storage
 */
async function saveGuestData(data: GuestViewData): Promise<void> {
  try {
    await AsyncStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving guest data:', error);
  }
}

/**
 * Check if guest can view a product
 * Returns: { allowed: boolean, reason?: string, timeRemaining?: string }
 */
export async function canGuestViewProduct(): Promise<{
  allowed: boolean;
  reason?: string;
  timeRemaining?: string;
}> {
  const deviceId = await getDeviceId();
  const guestData = await getGuestData();
  
  // First time - allow view
  if (!guestData) {
    return { allowed: true };
  }
  
  // Check if device matches (prevent device switching abuse)
  if (guestData.deviceId !== deviceId) {
    // Different device - treat as new guest but log suspicious activity
    console.warn('Device mismatch detected - potential abuse attempt');
    return { allowed: true };
  }
  
  // Already viewed 1 product
  if (guestData.viewCount >= 1) {
    const now = Date.now();
    const timeSinceLastView = now - guestData.lastViewTime;
    const cooldownPeriod = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    if (timeSinceLastView < cooldownPeriod) {
      // Still in cooldown
      const timeRemaining = cooldownPeriod - timeSinceLastView;
      const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
      const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
      
      return {
        allowed: false,
        reason: 'Presegli ste brezplačni limit (1 izdelek/24h)',
        timeRemaining: `${hours}h ${minutes}m`,
      };
    }
    
    // Cooldown expired - reset counter
    await saveGuestData({
      deviceId,
      viewCount: 0,
      lastViewTime: now,
      productViewed: null,
    });
    
    return { allowed: true };
  }
  
  // Haven't used the one free view yet
  return { allowed: true };
}

/**
 * Record a guest product view
 */
export async function recordGuestView(productId: string): Promise<void> {
  const deviceId = await getDeviceId();
  const guestData = await getGuestData();
  
  const newData: GuestViewData = {
    deviceId,
    viewCount: (guestData?.viewCount || 0) + 1,
    lastViewTime: Date.now(),
    productViewed: productId,
  };
  
  await saveGuestData(newData);
}

/**
 * Reset guest data (for testing or when user registers)
 */
export async function resetGuestData(): Promise<void> {
  try {
    await AsyncStorage.removeItem(GUEST_STORAGE_KEY);
  } catch (error) {
    console.error('Error resetting guest data:', error);
  }
}

/**
 * Get remaining guest views
 */
export async function getGuestViewsRemaining(): Promise<{
  remaining: number;
  timeUntilReset?: string;
}> {
  const guestData = await getGuestData();
  
  if (!guestData || guestData.viewCount === 0) {
    return { remaining: 1 };
  }
  
  if (guestData.viewCount >= 1) {
    const now = Date.now();
    const timeSinceLastView = now - guestData.lastViewTime;
    const cooldownPeriod = 24 * 60 * 60 * 1000;
    
    if (timeSinceLastView < cooldownPeriod) {
      const timeRemaining = cooldownPeriod - timeSinceLastView;
      const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
      const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
      
      return {
        remaining: 0,
        timeUntilReset: `${hours}h ${minutes}m`,
      };
    }
    
    // Cooldown expired
    return { remaining: 1 };
  }
  
  return { remaining: 1 - guestData.viewCount };
}
