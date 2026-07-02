import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Bell, Calendar, TrendingUp, AlertCircle, PlusCircle, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { InvestorCard } from '../../components/investor/InvestorCard';
import { useAuth } from '../../context/AuthContext';
import { investors } from '../../data/users';
import { getMyMeetings, Meeting } from '../../api/meetingService';
import api from '../../api/axios';
import toast from 'react-hot-toast';

interface CollabRequest {
  _id: string;
  sender: { _id: string; name: string; email: string; avatarUrl: string; role: string; startupName?: string; industry?: string };
  receiver: { _id: string; name: string; email: string; avatarUrl: string; role: string };
  message: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export const EntrepreneurDashboard: React.FC = () => {
  const { user } = useAuth();
  const [collaborationRequests, setCollaborationRequests] = useState<CollabRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [recommendedInvestors] = useState(investors.slice(0, 3));
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      // Load real collaboration requests
      api.get('/collaborations')
        .then(res => setCollaborationRequests(res.data))
        .catch(err => console.error('Failed to load requests:', err))
        .finally(() => setRequestsLoading(false));

      // Load real meetings
      getMyMeetings()
        .then(data => setMeetings(data))
        .catch(err => console.error('Failed to load meetings:', err))
        .finally(() => setMeetingsLoading(false));
    }
  }, [user]);

  const handleAccept = async (requestId: string) => {
    try {
      await api.put(`/collaborations/${requestId}/accept`);
      setCollaborationRequests(prev =>
        prev.map(r => r._id === requestId ? { ...r, status: 'accepted' } : r)
      );
      toast.success('Collaboration request accepted!');
    } catch {
      toast.error('Failed to accept request');
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await api.put(`/collaborations/${requestId}/reject`);
      setCollaborationRequests(prev =>
        prev.map(r => r._id === requestId ? { ...r, status: 'rejected' } : r)
      );
      toast.success('Request rejected');
    } catch {
      toast.error('Failed to reject request');
    }
  };

  if (!user) return null;

  const pendingRequests = collaborationRequests.filter(r => r.status === 'pending');
  const upcomingMeetings = meetings.filter(m =>
    m.status === 'accepted' && new Date(m.date) >= new Date()
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {user.name}</h1>
          <p className="text-gray-600">Here's what's happening with your startup today</p>
        </div>
        <Link to="/investors">
          <Button leftIcon={<PlusCircle size={18} />}>Find Investors</Button>
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-primary-50 border border-primary-100">
          <CardBody>
            <div className="flex items-center">
              <div className="p-3 bg-primary-100 rounded-full mr-4">
                <Bell size={20} className="text-primary-700" />
              </div>
              <div>
                <p className="text-sm font-medium text-primary-700">Pending Requests</p>
                <h3 className="text-xl font-semibold text-primary-900">
                  {requestsLoading ? '...' : pendingRequests.length}
                </h3>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="bg-secondary-50 border border-secondary-100">
          <CardBody>
            <div className="flex items-center">
              <div className="p-3 bg-secondary-100 rounded-full mr-4">
                <Users size={20} className="text-secondary-700" />
              </div>
              <div>
                <p className="text-sm font-medium text-secondary-700">Total Connections</p>
                <h3 className="text-xl font-semibold text-secondary-900">
                  {requestsLoading ? '...' : collaborationRequests.filter(r => r.status === 'accepted').length}
                </h3>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="bg-accent-50 border border-accent-100">
          <CardBody>
            <div className="flex items-center">
              <div className="p-3 bg-accent-100 rounded-full mr-4">
                <Calendar size={20} className="text-accent-700" />
              </div>
              <div>
                <p className="text-sm font-medium text-accent-700">Upcoming Meetings</p>
                <h3 className="text-xl font-semibold text-accent-900">
                  {meetingsLoading ? '...' : upcomingMeetings.length}
                </h3>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="bg-success-50 border border-success-100">
          <CardBody>
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-full mr-4">
                <TrendingUp size={20} className="text-success-700" />
              </div>
              <div>
                <p className="text-sm font-medium text-success-700">Profile Views</p>
                <h3 className="text-xl font-semibold text-success-900">24</h3>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Collaboration Requests */}
          <Card>
            <CardHeader className="flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">Collaboration Requests</h2>
              <Badge variant="primary">{pendingRequests.length} pending</Badge>
            </CardHeader>
            <CardBody>
              {requestsLoading ? (
                <p className="text-center text-gray-500 py-4">Loading requests...</p>
              ) : collaborationRequests.length > 0 ? (
                <div className="space-y-4">
                  {collaborationRequests.map(request => (
                    <div key={request._id} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <img
                            src={request.sender.avatarUrl || `https://ui-avatars.com/api/?name=${request.sender.name}`}
                            alt={request.sender.name}
                            className="w-10 h-10 rounded-full"
                          />
                          <div>
                            <p className="font-medium text-gray-900">{request.sender.name}</p>
                            <p className="text-sm text-gray-500 capitalize">{request.sender.role}</p>
                            {request.sender.startupName && (
                              <p className="text-sm text-gray-500">{request.sender.startupName}</p>
                            )}
                          </div>
                        </div>
                        <Badge
                          variant={request.status === 'accepted' ? 'success' : request.status === 'rejected' ? 'danger' : 'warning'}
                        >
                          {request.status}
                        </Badge>
                      </div>

                      {request.message && (
                        <p className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                          "{request.message}"
                        </p>
                      )}

                      {request.status === 'pending' && request.receiver._id === user.id && (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => handleAccept(request._id)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                          >
                            <CheckCircle size={14} /> Accept
                          </button>
                          <button
                            onClick={() => handleReject(request._id)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-600 text-sm rounded-lg hover:bg-red-200 transition-colors"
                          >
                            <XCircle size={14} /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                    <AlertCircle size={24} className="text-gray-500" />
                  </div>
                  <p className="text-gray-600">No collaboration requests yet</p>
                  <p className="text-sm text-gray-500 mt-1">
                    When investors are interested in your startup, their requests will appear here
                  </p>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Upcoming Meetings */}
          {upcomingMeetings.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-medium text-gray-900">Upcoming Meetings</h2>
              </CardHeader>
              <CardBody className="space-y-3">
                {upcomingMeetings.map(meeting => (
                  <div key={meeting._id} className="flex items-center justify-between p-3 bg-accent-50 rounded-lg border border-accent-100">
                    <div>
                      <p className="font-medium text-gray-900">{meeting.title}</p>
                      <p className="text-sm text-gray-600">
                        with {meeting.scheduledBy._id === user.id
                          ? meeting.scheduledWith.name
                          : meeting.scheduledBy.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(meeting.date).toLocaleDateString()} • {meeting.startTime} - {meeting.endTime}
                      </p>
                    </div>
                    <Badge variant="success">Confirmed</Badge>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}
        </div>

        {/* Recommended investors */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">Recommended Investors</h2>
              <Link to="/investors" className="text-sm font-medium text-primary-600 hover:text-primary-500">
                View all
              </Link>
            </CardHeader>
            <CardBody className="space-y-4">
              {recommendedInvestors.map(investor => (
                <InvestorCard key={investor.id} investor={investor} showActions={false} />
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
};