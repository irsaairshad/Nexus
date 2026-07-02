import api from './axios';

export interface Meeting {
  _id: string;
  title: string;
  scheduledBy: {
    _id: string;
    name: string;
    email: string;
    avatarUrl: string;
    role: string;
  };
  scheduledWith: {
    _id: string;
    name: string;
    email: string;
    avatarUrl: string;
    role: string;
  };
  date: string;
  startTime: string;
  endTime: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  message: string;
  meetingLink: string;
  createdAt: string;
}

// Get all my meetings
export const getMyMeetings = async (): Promise<Meeting[]> => {
  const response = await api.get('/meetings');
  return response.data;
};

// Schedule a new meeting
export const scheduleMeeting = async (data: {
  title: string;
  scheduledWith: string;
  date: string;
  startTime: string;
  endTime: string;
  message?: string;
}): Promise<Meeting> => {
  const response = await api.post('/meetings', data);
  return response.data;
};

// Accept a meeting
export const acceptMeeting = async (meetingId: string): Promise<Meeting> => {
  const response = await api.put(`/meetings/${meetingId}/accept`);
  return response.data;
};

// Reject a meeting
export const rejectMeeting = async (meetingId: string): Promise<Meeting> => {
  const response = await api.put(`/meetings/${meetingId}/reject`);
  return response.data;
};

// Cancel a meeting
export const cancelMeeting = async (meetingId: string): Promise<Meeting> => {
  const response = await api.put(`/meetings/${meetingId}/cancel`);
  return response.data;
};