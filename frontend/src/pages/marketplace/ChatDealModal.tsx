import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type {
  MarketplaceListing,
  MarketplaceConversation,
  MarketplaceMessage,
  MarketplaceOffer,
  MarketplaceTransaction,
  SellerProfile,
} from '@/types/marketplace';
import { marketplaceApi, getMarketplaceSocket } from '@/services/marketplace';
import {
  Send,
  Loader2,
  DollarSign,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Star,
  MapPin,
  Calendar,
  Clock,
  Check,
  PackageCheck,
} from 'lucide-react';

interface ChatDealModalProps {
  conversationId: string | null;
  listing: MarketplaceListing | null;
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  onOpenReviewModal?: (transactionId: string) => void;
  onDealCompleted?: () => void;
}

export const ChatDealModal: React.FC<ChatDealModalProps> = ({
  conversationId,
  listing,
  isOpen,
  onClose,
  currentUserId,
  onOpenReviewModal,
  onDealCompleted,
}) => {
  const [internalConvId, setInternalConvId] = useState<string | null>(conversationId);
  const [messages, setMessages] = useState<MarketplaceMessage[]>([]);
  const [conversation, setConversation] = useState<MarketplaceConversation | null>(null);
  const [activeOffer, setActiveOffer] = useState<MarketplaceOffer | null>(null);
  const [activeTransaction, setActiveTransaction] = useState<MarketplaceTransaction | null>(null);

  const [inputMessage, setInputMessage] = useState('');
  const [offerInput, setOfferInput] = useState('');
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [counterInput, setCounterInput] = useState('');
  const [showCounterForm, setShowCounterForm] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [scheduleLocation, setScheduleLocation] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [schedulingLoading, setSchedulingLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [partnerTyping, setPartnerTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);
  const initializingRef = useRef<boolean>(false);

  const effectiveConvId = internalConvId || conversationId;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadData = useCallback(async (convId: string) => {
    try {
      setLoading(true);
      setActionError(null);
      const res = await marketplaceApi.getConversationMessages(convId);
      setConversation(res.conversation);
      setMessages(res.messages || []);
      setActiveOffer(res.activeOffer || null);
      setActiveTransaction(res.activeTransaction || null);
      setTimeout(scrollToBottom, 100);
    } catch (err: any) {
      setActionError(err?.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const initConversation = useCallback(() => {
    if (conversationId) {
      loadData(conversationId);
    } else if (listing?.id && !initializingRef.current) {
      initializingRef.current = true;
      setLoading(true);
      setActionError(null);
      marketplaceApi
        .getOrCreateConversation(listing.id)
        .then((conv) => {
          setInternalConvId(conv.id);
          setConversation(conv);
          return loadData(conv.id);
        })
        .catch((err: any) => {
          setActionError(err?.response?.data?.message || 'Failed to initialize conversation');
          setLoading(false);
        })
        .finally(() => {
          initializingRef.current = false;
        });
    }
  }, [conversationId, listing?.id, loadData]);

  // Sync internalConvId when prop changes
  useEffect(() => {
    setInternalConvId(conversationId);
  }, [conversationId]);

  // Load conversation on open
  useEffect(() => {
    if (!isOpen) {
      initializingRef.current = false;
      setMessages([]);
      setConversation(null);
      setActiveOffer(null);
      setActiveTransaction(null);
      setActionError(null);
      setInternalConvId(null);
      return;
    }

    initConversation();
  }, [isOpen, initConversation]);

  // Socket room and event listeners
  useEffect(() => {
    if (!isOpen || !effectiveConvId) return;

    const socket = getMarketplaceSocket();
    socket.emit('joinConversation', { conversationId: effectiveConvId });

    const handleNewMessage = (msg: MarketplaceMessage) => {
      if (msg.conversationId === effectiveConvId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setTimeout(scrollToBottom, 100);
      }
    };

    const handleOfferUpdate = (data: any) => {
      if (data.offer) {
        setActiveOffer(data.offer);
      }
    };

    const handleTransactionUpdate = (data: any) => {
      if (data.tx) {
        setActiveTransaction(data.tx);
        if (data.type === 'TX_COMPLETED') {
          onDealCompleted?.();
        }
      }
    };

    const handleTyping = (data: { conversationId: string; isTyping: boolean }) => {
      if (data.conversationId === effectiveConvId) {
        setPartnerTyping(data.isTyping);
      }
    };

    socket.on('newMessage', handleNewMessage);
    socket.on('offerUpdate', handleOfferUpdate);
    socket.on('transactionUpdate', handleTransactionUpdate);
    socket.on('userTyping', handleTyping);

    return () => {
      socket.emit('leaveConversation', { conversationId: effectiveConvId });
      socket.off('newMessage', handleNewMessage);
      socket.off('offerUpdate', handleOfferUpdate);
      socket.off('transactionUpdate', handleTransactionUpdate);
      socket.off('userTyping', handleTyping);
    };
  }, [isOpen, effectiveConvId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !effectiveConvId) return;

    const text = inputMessage.trim();
    try {
      setSendingMsg(true);
      setInputMessage('');

      const socket = getMarketplaceSocket();
      socket.emit('typingIndicator', { conversationId: effectiveConvId, isTyping: false });

      const sentMsg = await marketplaceApi.sendMessage(effectiveConvId, text);
      if (sentMsg) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === sentMsg.id)) return prev;
          return [...prev, sentMsg];
        });
        setTimeout(scrollToBottom, 50);
      }
    } catch (err: any) {
      setInputMessage(text);
      setActionError(err?.response?.data?.message || 'Failed to send message');
    } finally {
      setSendingMsg(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);
    if (!effectiveConvId) return;

    const socket = getMarketplaceSocket();
    socket.emit('typingIndicator', { conversationId: effectiveConvId, isTyping: true });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typingIndicator', { conversationId: effectiveConvId, isTyping: false });
    }, 1500);
  };

  const handleMakeOffer = async () => {
    const amount = parseFloat(offerInput);
    const listingId = conversation?.listingId || listing?.id;
    if (isNaN(amount) || amount <= 0 || !listingId) return;

    try {
      setActionError(null);
      const offer = await marketplaceApi.createOffer(listingId, amount);
      setActiveOffer(offer);
      setShowOfferForm(false);
      setOfferInput('');
      if (effectiveConvId) {
        loadData(effectiveConvId);
      }
    } catch (err: any) {
      setActionError(err?.response?.data?.message || 'Failed to submit offer');
    }
  };

  const handleRespondOffer = async (
    action: 'ACCEPT' | 'REJECT' | 'COUNTER' | 'CANCEL',
    counterAmount?: number,
  ) => {
    if (!activeOffer) return;
    try {
      setActionError(null);
      const updated = await marketplaceApi.respondOffer(activeOffer.id, action, counterAmount);
      setActiveOffer(updated);
      setShowCounterForm(false);
      setCounterInput('');

      if (effectiveConvId) {
        await loadData(effectiveConvId);
      }
    } catch (err: any) {
      setActionError(err?.response?.data?.message || 'Failed to respond to offer');
    }
  };

  const handleVerifyOtp = async () => {
    if (!activeTransaction || !otpInput.trim()) return;
    try {
      setOtpLoading(true);
      setActionError(null);
      const res = await marketplaceApi.verifyHandover(activeTransaction.id, otpInput.trim());
      setActiveTransaction(res.transaction);
      setOtpInput('');
      onDealCompleted?.();
    } catch (err: any) {
      setActionError(err?.response?.data?.message || 'Invalid OTP code');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleRegenerateOtp = async () => {
    if (!activeTransaction) return;
    try {
      setActionError(null);
      const res = await marketplaceApi.regenerateOtp(activeTransaction.id);
      setActiveTransaction((prev) => (prev ? { ...prev, handoverOtp: res.handoverOtp } : null));
    } catch (err: any) {
      setActionError(err?.response?.data?.message || 'Failed to regenerate OTP');
    }
  };

  useEffect(() => {
    if (activeTransaction) {
      setScheduleLocation(
        activeTransaction.handoverLocation ||
          conversation?.listing?.preferredLocation ||
          listing?.preferredLocation ||
          'Campus Center',
      );
      if (activeTransaction.handoverDate) {
        setScheduleDate(activeTransaction.handoverDate);
      } else {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setScheduleDate(tomorrow.toISOString().split('T')[0]);
      }
      if (activeTransaction.handoverTime) {
        setScheduleTime(activeTransaction.handoverTime);
      } else {
        setScheduleTime('14:00');
      }
    }
  }, [activeTransaction, conversation?.listing?.preferredLocation, listing?.preferredLocation]);

  const handleConfirmSchedule = async () => {
    if (!activeTransaction) return;
    if (!scheduleLocation.trim() || !scheduleDate.trim() || !scheduleTime.trim()) {
      setActionError('Please enter a location, date, and time for the handover');
      return;
    }
    try {
      setSchedulingLoading(true);
      setActionError(null);
      const updated = await marketplaceApi.confirmSchedule(activeTransaction.id, {
        location: scheduleLocation.trim(),
        date: scheduleDate.trim(),
        time: scheduleTime.trim(),
      });
      setActiveTransaction(updated);
      if (effectiveConvId) {
        loadData(effectiveConvId);
      }
    } catch (err: any) {
      setActionError(err?.response?.data?.message || 'Failed to confirm schedule');
    } finally {
      setSchedulingLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentListing = conversation?.listing || listing;
  const isSeller = conversation
    ? conversation.sellerId === currentUserId
    : (listing ? listing.sellerId === currentUserId : false);
  const isBuyer = !isSeller;

  const otherParty: SellerProfile | null | undefined =
    conversation?.otherParty ||
    (conversation
      ? (isSeller ? conversation.buyer : (conversation.seller || listing?.seller))
      : (isSeller ? null : listing?.seller));

  const getParticipantName = (party: SellerProfile | null | undefined, fallback: string) => {
    if (!party) return fallback;
    if (party.student) {
      const name = `${party.student.firstName} ${party.student.lastName || ''}`.trim();
      if (name) return name;
    }
    if (party.faculty) {
      const name = `${party.faculty.firstName} ${party.faculty.lastName || ''}`.trim();
      if (name) return name;
    }
    if (party.adminProfile?.name) {
      const name = party.adminProfile.name.trim();
      if (name) return name;
    }
    if (party.email) {
      return party.email.split('@')[0];
    }
    return fallback;
  };

  const otherPartyName = getParticipantName(
    otherParty,
    isSeller ? 'Prospective Buyer' : 'Seller'
  );

  const otherPartyBadge = otherParty?.student
    ? 'Student'
    : otherParty?.faculty
    ? 'Faculty'
    : otherParty?.adminProfile
    ? 'Admin'
    : (isSeller ? 'Buyer' : 'Seller');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b bg-muted/30 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="size-9 border">
                <AvatarFallback className="font-bold bg-primary/10 text-primary">
                  {otherPartyName.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="text-sm font-semibold flex items-center gap-2">
                  <span>{otherPartyName}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {otherPartyBadge}
                  </Badge>
                </DialogTitle>
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <span className="font-medium text-foreground">{currentListing?.title}</span>
                  <span>•</span>
                  <span className="font-bold text-foreground">
                    ₹{currentListing?.price.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {currentListing?.preferredLocation && (
              <div className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground bg-background px-2.5 py-1 rounded-md border shadow-2xs">
                <MapPin className="size-3 text-primary" />
                <span>{currentListing.preferredLocation}</span>
              </div>
            )}
          </div>
        </DialogHeader>

        {actionError && (
          <div className="bg-red-50 text-red-700 border-b border-red-200 px-4 py-2.5 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{actionError}</span>
            </div>
            {!effectiveConvId && (
              <Button
                size="sm"
                variant="outline"
                onClick={initConversation}
                className="h-6 text-[11px] px-2 bg-white text-red-700 hover:bg-red-100 border-red-300"
              >
                Retry
              </Button>
            )}
          </div>
        )}

        <div className="bg-card border-b p-3 shrink-0 space-y-2">
          {activeTransaction && (
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-primary">
                  <ShieldCheck className="size-4" />
                  Status:{' '}
                  <Badge variant="outline" className="font-bold">
                    {activeTransaction.status}
                  </Badge>
                </span>
                <span className="font-bold text-sm">
                  Agreed Price: ₹{activeTransaction.agreedPrice.toLocaleString('en-IN')}
                </span>
              </div>

              {/* STEP 2: DEAL FINALIZATION & SCHEDULING (PRICE_AGREED / INITIATED) */}
              {(activeTransaction.status === 'PRICE_AGREED' || activeTransaction.status === 'INITIATED') && (
                <div className="pt-2 border-t border-primary/10 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between text-xs gap-1.5">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <Calendar className="size-3.5 text-primary" />
                      Step 2: Finalize Handover Arrangement
                    </span>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <Badge
                        variant={activeTransaction.buyerConfirmed ? 'default' : 'secondary'}
                        className={`text-[10px] ${activeTransaction.buyerConfirmed ? 'bg-emerald-600 hover:bg-emerald-600' : ''}`}
                      >
                        {activeTransaction.buyerConfirmed ? '✓ Buyer Confirmed' : 'Buyer Pending'}
                      </Badge>
                      <Badge
                        variant={activeTransaction.sellerConfirmed ? 'default' : 'secondary'}
                        className={`text-[10px] ${activeTransaction.sellerConfirmed ? 'bg-emerald-600 hover:bg-emerald-600' : ''}`}
                      >
                        {activeTransaction.sellerConfirmed ? '✓ Seller Confirmed' : 'Seller Pending'}
                      </Badge>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    Confirm a safe campus meeting spot and time. Once both parties confirm, the buyer's 6-digit verification OTP will be unlocked.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1 mb-1">
                        <MapPin className="size-3 text-primary" /> Location
                      </label>
                      <Input
                        value={scheduleLocation}
                        onChange={(e) => setScheduleLocation(e.target.value)}
                        placeholder="e.g. Central Library"
                        className="h-7 text-xs bg-background"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1 mb-1">
                        <Calendar className="size-3 text-primary" /> Date
                      </label>
                      <Input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className="h-7 text-xs bg-background"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1 mb-1">
                        <Clock className="size-3 text-primary" /> Time
                      </label>
                      <Input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="h-7 text-xs bg-background"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button
                      size="sm"
                      onClick={handleConfirmSchedule}
                      disabled={schedulingLoading || !scheduleLocation.trim() || !scheduleDate.trim() || !scheduleTime.trim()}
                      className="h-7 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                    >
                      {schedulingLoading ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Check className="size-3.5" />
                      )}
                      {(isBuyer && activeTransaction.buyerConfirmed) || (isSeller && activeTransaction.sellerConfirmed)
                        ? 'Update Meeting Details'
                        : 'Confirm Handover Arrangement'}
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 3: PHYSICAL HANDOVER & OTP VERIFICATION */}
              {activeTransaction.status === 'HANDOVER_PENDING' && (
                <div className="pt-2 border-t border-primary/10 space-y-2">
                  <div className="flex flex-wrap items-center justify-between text-xs bg-background/80 p-2 rounded-lg border gap-2">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <MapPin className="size-3.5 text-primary shrink-0" />
                      <span className="font-medium text-foreground">
                        {activeTransaction.handoverLocation || 'Campus Meeting Point'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground text-[11px]">
                      {activeTransaction.handoverDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3 text-primary" />
                          {activeTransaction.handoverDate}
                        </span>
                      )}
                      {activeTransaction.handoverTime && (
                        <span className="flex items-center gap-1">
                          <Clock className="size-3 text-primary" />
                          {activeTransaction.handoverTime}
                        </span>
                      )}
                    </div>
                  </div>

                  {isBuyer ? (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-2.5 bg-primary/10 rounded-lg border border-primary/20">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                          <ShieldCheck className="size-3.5" />
                          Your 6-Digit Handover Code
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Inspect item physically first. Disclose code to seller only upon receiving the item.
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-primary text-primary-foreground font-mono font-bold text-xl px-4 py-1.5 rounded-lg tracking-widest shadow-sm select-all">
                          {activeTransaction.handoverOtp || '••••••'}
                        </div>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={handleRegenerateOtp}
                          title="Generate new OTP"
                          className="size-8 shrink-0 bg-background"
                        >
                          <RefreshCw className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                      <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <PackageCheck className="size-4 text-emerald-600" />
                          Enter Buyer's 6-Digit Handover OTP:
                        </span>
                        {typeof activeTransaction.handoverOtpAttempts === 'number' && (
                          <span className="text-[10px] text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            {5 - activeTransaction.handoverOtpAttempts} attempts left
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Hand over the item and enter the 6-digit OTP given by the buyer to complete this sale.
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Input
                          placeholder="000000"
                          maxLength={6}
                          value={otpInput}
                          onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                          className="font-mono tracking-widest text-center h-8 text-base font-bold bg-background"
                        />
                        <Button
                          size="sm"
                          onClick={handleVerifyOtp}
                          disabled={otpLoading || otpInput.length !== 6}
                          className="gap-1.5 h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shrink-0"
                        >
                          {otpLoading && <Loader2 className="size-3.5 animate-spin" />}
                          Verify & Complete
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 4: DEAL COMPLETED */}
              {activeTransaction.status === 'COMPLETED' && (
                <div className="pt-2 border-t border-emerald-200 text-emerald-950 text-xs">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-600 text-white font-bold text-[11px] px-2.5 py-0.5">
                          {isBuyer ? 'Order Received' : 'Sold / Handover Completed'}
                        </Badge>
                        <span className="font-semibold text-emerald-900 flex items-center gap-1">
                          <CheckCircle2 className="size-4 text-emerald-600" />
                          Handover Verified
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-800">
                        {isBuyer
                          ? 'You have verified receipt of this item on campus. The transaction is complete.'
                          : 'OTP successfully verified. The listing is marked SOLD and automatically unlisted from the marketplace.'}
                      </p>
                    </div>

                    {isBuyer && !activeTransaction.review && onOpenReviewModal && (
                      <Button
                        size="sm"
                        onClick={() => onOpenReviewModal(activeTransaction.id)}
                        className="gap-1.5 h-8 text-xs bg-amber-500 hover:bg-amber-600 text-white font-semibold shrink-0 shadow-xs"
                      >
                        <Star className="size-3.5 fill-white" />
                        Rate & Review Seller
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {(!activeTransaction || activeTransaction.status !== 'COMPLETED') && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              {activeOffer && activeOffer.status === 'PENDING' ? (
                <div className="flex flex-wrap items-center justify-between w-full gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="size-4 text-amber-600" />
                    <span>
                      Active Offer:{' '}
                      <strong className="text-foreground">
                        ₹{activeOffer.amount.toLocaleString('en-IN')}
                      </strong>
                      {activeOffer.counterAmount && (
                        <span className="text-amber-700 ml-1">
                          (Counter: ₹{activeOffer.counterAmount.toLocaleString('en-IN')})
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isSeller && !activeOffer.counterAmount && (
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleRespondOffer('ACCEPT')}
                          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowCounterForm(true)}
                          className="h-7 text-xs"
                        >
                          Counter
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRespondOffer('REJECT')}
                          className="h-7 text-xs text-destructive hover:bg-destructive/10"
                        >
                          Decline
                        </Button>
                      </>
                    )}

                    {isBuyer && activeOffer.counterAmount && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleRespondOffer('ACCEPT')}
                          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                        >
                          Accept Counter
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRespondOffer('REJECT')}
                          className="h-7 text-xs text-destructive"
                        >
                          Decline
                        </Button>
                      </>
                    )}

                    {isBuyer && !activeOffer.counterAmount && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRespondOffer('CANCEL')}
                        className="h-7 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Cancel Offer
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                isBuyer &&
                !activeTransaction && (
                  <div className="flex items-center justify-between w-full">
                    <span className="text-muted-foreground">
                      Want to negotiate the asking price?
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowOfferForm(!showOfferForm)}
                      className="h-7 text-xs gap-1"
                    >
                      <DollarSign className="size-3" />
                      Make Structured Offer
                    </Button>
                  </div>
                )
              )}

              {showOfferForm && (
                <div className="w-full flex gap-2 pt-1 border-t">
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1.5 text-xs text-muted-foreground">
                      ₹
                    </span>
                    <Input
                      type="number"
                      placeholder="Enter offer amount"
                      value={offerInput}
                      onChange={(e) => setOfferInput(e.target.value)}
                      className="h-7 pl-6 text-xs"
                    />
                  </div>
                  <Button size="sm" onClick={handleMakeOffer} className="h-7 text-xs">
                    Send Offer
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowOfferForm(false)}
                    className="h-7 text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              )}

              {showCounterForm && (
                <div className="w-full flex gap-2 pt-1 border-t">
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1.5 text-xs text-muted-foreground">
                      ₹
                    </span>
                    <Input
                      type="number"
                      placeholder="Enter counter amount"
                      value={counterInput}
                      onChange={(e) => setCounterInput(e.target.value)}
                      className="h-7 pl-6 text-xs"
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleRespondOffer('COUNTER', parseFloat(counterInput))}
                    className="h-7 text-xs"
                  >
                    Send Counter
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowCounterForm(false)}
                    className="h-7 text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/10">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-6">
              <ShieldCheck className="size-10 stroke-[1.2] text-primary/60 mb-2" />
              <p className="text-sm font-semibold text-foreground">Direct Campus Chat</p>
              <p className="text-xs max-w-sm mt-1">
                Say hello, ask questions about the item's condition, or arrange where to meet on
                campus for the handover.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.senderId === currentUserId;
              const isSystem = msg.messageType !== 'TEXT';

              if (isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center my-2">
                    <div className="bg-muted px-3 py-1 rounded-full text-[11px] font-medium text-muted-foreground border shadow-2xs">
                      {msg.content}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-2xs ${
                      isMine
                        ? 'bg-primary text-primary-foreground rounded-br-xs'
                        : 'bg-card text-card-foreground border rounded-bl-xs'
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    <div
                      className={`text-[9px] mt-1 text-right ${
                        isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      }`}
                    >
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {partnerTyping && (
            <div className="text-[11px] text-muted-foreground italic flex items-center gap-1.5 pl-2">
              <span className="size-1.5 bg-muted-foreground rounded-full animate-bounce" />
              <span>{otherPartyName} is typing...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <form
          onSubmit={handleSendMessage}
          className="p-3 border-t bg-background flex items-center gap-2 shrink-0"
        >
          <Input
            placeholder={
              !effectiveConvId
                ? 'Initializing conversation...'
                : 'Type a message or proposed meeting spot...'
            }
            value={inputMessage}
            onChange={handleInputChange}
            disabled={!effectiveConvId || loading}
            className="flex-1 text-sm rounded-full bg-muted/30 focus-visible:ring-1"
          />
          <Button
            type="submit"
            size="icon"
            disabled={sendingMsg || !inputMessage.trim() || !effectiveConvId || loading}
            className="rounded-full shrink-0 shadow-xs"
          >
            {sendingMsg ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
