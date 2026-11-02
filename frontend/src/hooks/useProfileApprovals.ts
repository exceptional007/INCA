import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import api from '@/api/axios';

export function useProfileApprovals() {
  const { user, isLoading } = useAuth();
  return useQuery<any[]>({
    queryKey: ['profile-review-queue', user?.id],
    enabled: !isLoading && !!user && ['HOD', 'ADMIN', 'SUPER_ADMIN'].includes(user.role.code),
    queryFn: async () => {
      const response = await api.get('/profile/review-queue');
      if (!Array.isArray(response.data)) throw new Error('Could not load profile approvals.');
      return response.data;
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}
