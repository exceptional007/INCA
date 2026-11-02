import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import api from '@/api/axios';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function useProfileIdentity() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ['profile-identity', user?.id],
    enabled: !!user,
    queryFn: async () => (await api.get('/profile')).data,
    staleTime: 60_000,
  });
  const owned = data?.id === user?.id ? data : null;
  const name = owned?.values?.name || [owned?.values?.firstName, owned?.values?.lastName].filter(Boolean).join(' ') ||
    [user?.faculty?.firstName || user?.student?.firstName, user?.faculty?.lastName || user?.student?.lastName].filter(Boolean).join(' ') || user?.email?.split('@')[0] || 'My profile';
  return { name, photoUrl: owned?.values?.photoKey ? `/profile/photo?v=${encodeURIComponent(owned.revision)}` : undefined };
}

export function UserAvatar({ className = 'h-8 w-8' }: { className?: string }) {
  const { user } = useAuth();
  const { name, photoUrl } = useProfileIdentity();
  const { data: photo } = useQuery({
    queryKey: ['profile-photo', user?.id, photoUrl], enabled: !!photoUrl,
    queryFn: async () => (await api.get(photoUrl!, { responseType: 'blob' })).data as Blob,
    staleTime: 60_000,
  });
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  useEffect(() => {
    if (!photo || !photoUrl) return;
    const url = URL.createObjectURL(photo);
    setImage({ blob: photo, url });
    return () => URL.revokeObjectURL(url);
  }, [photo, photoUrl]);
  return <Avatar className={className}>
    <AvatarImage src={photoUrl && image && image.blob === photo ? image.url : undefined} alt={`${name}'s profile photo`} />
    <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">{name.split(/\s+/).slice(0, 2).map((part: string) => part[0]).join('').toUpperCase()}</AvatarFallback>
  </Avatar>;
}
