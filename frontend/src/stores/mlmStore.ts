import { create } from 'zustand';
import { api } from '@/services/api';
import { toast } from 'sonner';
import type { BinaryTreeNode } from '@/components/referral/GenealogyTree';
import {
  pickReferralCodeFromObject,
  type AuthMeSnippet,
  type ReferralMeProfile
} from '@/utils/referralCode';

export type MlmStats = {
  leftBV: number;
  rightBV: number;
  weakLeg: 'left' | 'right';
  todayIncome: number;
  totalIncome: number;
};

export type DirectRow = {
  id: number;
  name: string;
  email: string;
  referral_code: string;
  placement_parent_user_id?: number | null;
  placement_side?: string | null;
};

export type ComplianceSnippet = {
  kyc: Record<string, unknown> | null;
  userScore: { score: number; level: string } | null;
};

const defaultMlm: MlmStats = {
  leftBV: 0,
  rightBV: 0,
  weakLeg: 'left',
  todayIncome: 0,
  totalIncome: 0
};

type MlmState = {
  loading: boolean;
  me: ReferralMeProfile | null;
  authMeUser: AuthMeSnippet;
  mlmStats: MlmStats;
  summary: Record<string, unknown> | null;
  directs: DirectRow[];
  commissions: Record<string, unknown>[];
  tree: BinaryTreeNode | null;
  compliance: ComplianceSnippet;
  loadReferralPage: () => Promise<void>;
  reset: () => void;
};

export const useMlmStore = create<MlmState>((set, get) => ({
  loading: true,
  me: null,
  authMeUser: null,
  mlmStats: defaultMlm,
  summary: null,
  directs: [],
  commissions: [],
  tree: null,
  compliance: { kyc: null, userScore: null },

  reset: () =>
    set({
      loading: false,
      me: null,
      authMeUser: null,
      mlmStats: defaultMlm,
      summary: null,
      directs: [],
      commissions: [],
      tree: null,
      compliance: { kyc: null, userScore: null }
    }),

  loadReferralPage: async () => {
    set({ loading: true });
    try {
      const rMe = await api.get('/referral/me');
      const d = rMe.data as Record<string, unknown> & {
        profile?: ReferralMeProfile | null;
        referralCode?: string | null;
        referral_code?: string | null;
        code?: string | null;
        kyc?: Record<string, unknown> | null;
        userScore?: { score: number; level: string } | null;
      };
      let profile = (d.profile ?? null) as ReferralMeProfile | null;
      const apiRoot = pickReferralCodeFromObject(d as Record<string, unknown>);
      if (apiRoot && !pickReferralCodeFromObject(profile as Record<string, unknown> | null)) {
        profile = { ...(profile || {}), referral_code: apiRoot, referralCode: apiRoot, code: apiRoot };
      }
      set({
        me: profile,
        compliance: {
          kyc: (d.kyc as Record<string, unknown> | null) ?? null,
          userScore: d.userScore ?? null
        }
      });

      const settled = await Promise.allSettled([
        api.get('/mlm/stats'),
        api.get('/referral/binary-summary'),
        api.get('/referral/directs'),
        api.get('/referral/commissions?pageSize=25'),
        api.get('/referral/tree', { params: { depth: 5 } }),
        api.get('/auth/me').catch(() => ({ data: { user: null } }))
      ]);

      const rMlm = settled[0].status === 'fulfilled' ? settled[0].value : null;
      const rSum = settled[1].status === 'fulfilled' ? settled[1].value : null;
      const rDir = settled[2].status === 'fulfilled' ? settled[2].value : null;
      const rComm = settled[3].status === 'fulfilled' ? settled[3].value : null;
      const rTree = settled[4].status === 'fulfilled' ? settled[4].value : null;
      const rAuthMe = settled[5].status === 'fulfilled' ? settled[5].value : null;

      const mlmPayload = rMlm?.data as Record<string, unknown> | undefined;
      if (mlmPayload && typeof mlmPayload === 'object') {
        set({
          mlmStats: {
            leftBV: Number(mlmPayload.leftBV ?? 0),
            rightBV: Number(mlmPayload.rightBV ?? 0),
            weakLeg: mlmPayload.weakLeg === 'right' ? 'right' : 'left',
            todayIncome: Number(mlmPayload.todayIncome ?? 0),
            totalIncome: Number(mlmPayload.totalIncome ?? 0)
          }
        });
      }

      const u = rAuthMe?.data?.user;
      const authSnippet = u && typeof u === 'object' ? (u as AuthMeSnippet) : null;
      const authCode = pickReferralCodeFromObject(authSnippet as Record<string, unknown> | null);
      let nextProfile = get().me;
      if (authCode && !pickReferralCodeFromObject(nextProfile as Record<string, unknown> | null)) {
        nextProfile = { ...(nextProfile || {}), referral_code: authCode, referralCode: authCode, code: authCode };
        set({ me: nextProfile });
      }
      set({ authMeUser: authSnippet });

      if (rSum?.data) set({ summary: rSum.data as Record<string, unknown> });
      if (rDir?.data) set({ directs: (rDir.data as { items?: DirectRow[] }).items || [] });
      if (rComm?.data) set({ commissions: (rComm.data as { items?: Record<string, unknown>[] }).items || [] });
      const treePayload = rTree?.data as { tree?: BinaryTreeNode | null } | undefined;
      set({ tree: treePayload && 'tree' in treePayload ? (treePayload.tree ?? null) : null });

    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Could not load referral data');
    } finally {
      set({ loading: false });
    }
  }
}));
