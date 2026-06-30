import React, { createContext, useState, useContext, useEffect } from 'react';
import { User, UserRole, AuthContextType } from '../types';
import toast from 'react-hot-toast';
import api from '../api/axios';

// Create Auth Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Local storage key
const USER_STORAGE_KEY = 'business_nexus_user';

// Maps the backend's MongoDB response (_id, etc.) into the frontend's User shape (id, etc.)
const mapBackendUserToFrontend = (backendUser: any): User & { token?: string } => {
  return {
    ...backendUser,
    id: backendUser._id,
  };
};

// Auth Provider Component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for stored user on initial load
  useEffect(() => {
    const storedUser = localStorage.getItem(USER_STORAGE_KEY);
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  // Login - real API call
  const login = async (email: string, password: string, role: UserRole): Promise<void> => {
    setIsLoading(true);

    try {
      const response = await api.post('/auth/login', { email, password, role });
      const mappedUser = mapBackendUserToFrontend(response.data);

      setUser(mappedUser);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(mappedUser));
      toast.success('Successfully logged in!');
    } catch (error: any) {
      const message = error.response?.data?.message || 'Invalid credentials or user not found';
      toast.error(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Register - real API call
  const register = async (name: string, email: string, password: string, role: UserRole): Promise<void> => {
    setIsLoading(true);

    try {
      const response = await api.post('/auth/register', { name, email, password, role });
      const mappedUser = mapBackendUserToFrontend(response.data);

      setUser(mappedUser);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(mappedUser));
      toast.success('Account created successfully!');
    } catch (error: any) {
      const message = error.response?.data?.message || 'Email already in use';
      toast.error(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Forgot password - real API call
  const forgotPassword = async (email: string): Promise<void> => {
    try {
      await api.post('/auth/forgot-password', { email });
      toast.success('Password reset instructions sent to your email');
    } catch (error: any) {
      const message = error.response?.data?.message || 'No account found with this email';
      toast.error(message);
      throw new Error(message);
    }
  };

  // Reset password - real API call
  const resetPassword = async (token: string, newPassword: string): Promise<void> => {
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      toast.success('Password reset successfully');
    } catch (error: any) {
      const message = error.response?.data?.message || 'Invalid or expired reset token';
      toast.error(message);
      throw new Error(message);
    }
  };

  // Logout function
  const logout = (): void => {
    setUser(null);
    localStorage.removeItem(USER_STORAGE_KEY);
    toast.success('Logged out successfully');
  };

  // Update user profile - real API call
  const updateProfile = async (userId: string, updates: Partial<User>): Promise<void> => {
    try {
      const response = await api.put(`/users/${userId}`, updates);
      const mappedUser = mapBackendUserToFrontend(response.data);

      if (user?.id === userId) {
        const storedUser = localStorage.getItem(USER_STORAGE_KEY);
        const token = storedUser ? JSON.parse(storedUser).token : undefined;
        const updatedUser = { ...mappedUser, token };

        setUser(updatedUser);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
      }

      toast.success('Profile updated successfully');
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to update profile';
      toast.error(message);
      throw new Error(message);
    }
  };

  const value = {
    user,
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
    updateProfile,
    isAuthenticated: !!user,
    isLoading
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook for using auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};