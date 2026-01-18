/**
 * Style Guide - Visual review of all design system components
 */

import { useState } from 'react';
import {
  GlassCard,
  StatCard,
  Button,
  Input,
  PasswordInput,
  Badge,
  ModeBadge,
  ConfirmModal,
  Skeleton,
  SkeletonCard,
  useToast,
} from '../components/ui';

export default function StyleGuidePage() {
  const [modalOpen, setModalOpen] = useState(false);
  const { addToast } = useToast();

  return (
    <div className="p-6 space-y-12">
      <header>
        <h1 className="text-3xl font-bold text-white mb-2">Style Guide</h1>
        <p className="text-white/60">Glassmorphism Minimal Ops Design System</p>
      </header>

      {/* Typography */}
      <section>
        <h2 className="text-xl font-semibold text-white mb-4 border-b border-white/20 pb-2">
          Typography
        </h2>
        <div className="space-y-3">
          <p className="text-4xl font-bold text-white">Heading 1 (4xl)</p>
          <p className="text-3xl font-bold text-white">Heading 2 (3xl)</p>
          <p className="text-2xl font-semibold text-white">Heading 3 (2xl)</p>
          <p className="text-xl font-semibold text-white">Heading 4 (xl)</p>
          <p className="text-lg text-white">Body Large (lg)</p>
          <p className="text-base text-white">Body Base</p>
          <p className="text-sm text-white/80">Body Small (sm)</p>
          <p className="text-xs text-white/60">Caption (xs)</p>
        </div>
      </section>

      {/* Colors */}
      <section>
        <h2 className="text-xl font-semibold text-white mb-4 border-b border-white/20 pb-2">
          Colors
        </h2>
        <div className="flex flex-wrap gap-4">
          <div className="w-20 h-20 rounded-xl bg-indigo-500 flex items-center justify-center text-white text-xs">Primary</div>
          <div className="w-20 h-20 rounded-xl bg-green-500 flex items-center justify-center text-white text-xs">Success</div>
          <div className="w-20 h-20 rounded-xl bg-yellow-500 flex items-center justify-center text-gray-900 text-xs">Warning</div>
          <div className="w-20 h-20 rounded-xl bg-red-500 flex items-center justify-center text-white text-xs">Danger</div>
          <div className="w-20 h-20 rounded-xl bg-blue-500 flex items-center justify-center text-white text-xs">Info</div>
          <div className="w-20 h-20 rounded-xl bg-white/20 flex items-center justify-center text-white text-xs">Glass</div>
        </div>
      </section>

      {/* GlassCard */}
      <section>
        <h2 className="text-xl font-semibold text-white mb-4 border-b border-white/20 pb-2">
          GlassCard
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <GlassCard variant="default" padding="md">
            <p className="text-white">Default Variant</p>
          </GlassCard>
          <GlassCard variant="dark" padding="md">
            <p className="text-white">Dark Variant</p>
          </GlassCard>
          <GlassCard variant="elevated" padding="md">
            <p className="text-white">Elevated Variant</p>
          </GlassCard>
          <GlassCard borderColor="success" padding="md">
            <p className="text-white">Success Border</p>
          </GlassCard>
          <GlassCard borderColor="warning" padding="md">
            <p className="text-white">Warning Border</p>
          </GlassCard>
          <GlassCard borderColor="danger" padding="md">
            <p className="text-white">Danger Border</p>
          </GlassCard>
        </div>
      </section>

      {/* StatCard */}
      <section>
        <h2 className="text-xl font-semibold text-white mb-4 border-b border-white/20 pb-2">
          StatCard
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="Total Queries" value="12,345" icon="📊" />
          <StatCard label="Cache Hit" value="87.5%" trend="up" trendValue="5.2%" icon="💾" />
          <StatCard label="SERVFAIL" value="23" trend="down" trendValue="10%" icon="⚠️" />
          <StatCard label="Loading" value="..." loading icon="⏳" />
        </div>
      </section>

      {/* Buttons */}
      <section>
        <h2 className="text-xl font-semibold text-white mb-4 border-b border-white/20 pb-2">
          Buttons
        </h2>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button loading>Loading</Button>
            <Button disabled>Disabled</Button>
            <Button icon="🔄">With Icon</Button>
          </div>
        </div>
      </section>

      {/* Inputs */}
      <section>
        <h2 className="text-xl font-semibold text-white mb-4 border-b border-white/20 pb-2">
          Inputs
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          <Input label="Username" placeholder="Enter username" />
          <Input label="With Error" placeholder="Invalid input" error="This field is required" />
          <Input label="With Hint" placeholder="example@email.com" hint="We'll never share your email" />
          <PasswordInput label="Password" placeholder="Enter password" />
        </div>
      </section>

      {/* Badges */}
      <section>
        <h2 className="text-xl font-semibold text-white mb-4 border-b border-white/20 pb-2">
          Badges
        </h2>
        <div className="flex flex-wrap gap-3">
          <Badge>Default</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="danger">Danger</Badge>
          <Badge variant="info">Info</Badge>
          <Badge variant="success" dot>With Dot</Badge>
          <Badge variant="danger" dot pulse>Pulsing</Badge>
        </div>
        <div className="flex flex-wrap gap-3 mt-4">
          <ModeBadge mode="recursive" />
          <ModeBadge mode="dot" />
          <ModeBadge mode="doh" />
        </div>
      </section>

      {/* Skeleton */}
      <section>
        <h2 className="text-xl font-semibold text-white mb-4 border-b border-white/20 pb-2">
          Skeleton
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SkeletonCard />
          <GlassCard padding="md">
            <div className="flex items-center gap-3 mb-4">
              <Skeleton variant="circular" width="48px" height="48px" />
              <div className="flex-1">
                <Skeleton width="60%" className="mb-2" />
                <Skeleton width="40%" />
              </div>
            </div>
            <Skeleton height="1rem" className="mb-2" />
            <Skeleton height="1rem" className="mb-2" />
            <Skeleton height="1rem" width="70%" />
          </GlassCard>
          <GlassCard padding="md">
            <Skeleton variant="rectangular" height="120px" className="mb-3" />
            <Skeleton width="80%" className="mb-2" />
            <Skeleton width="60%" />
          </GlassCard>
        </div>
      </section>

      {/* Modal & Toast */}
      <section>
        <h2 className="text-xl font-semibold text-white mb-4 border-b border-white/20 pb-2">
          Modal & Toast
        </h2>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setModalOpen(true)}>Open Modal</Button>
          <Button variant="secondary" onClick={() => addToast('success', 'Operation completed successfully!')}>
            Success Toast
          </Button>
          <Button variant="secondary" onClick={() => addToast('error', 'Something went wrong!')}>
            Error Toast
          </Button>
          <Button variant="secondary" onClick={() => addToast('warning', 'Please review your input')}>
            Warning Toast
          </Button>
          <Button variant="secondary" onClick={() => addToast('info', 'New update available')}>
            Info Toast
          </Button>
        </div>
      </section>

      {/* Spacing Scale */}
      <section>
        <h2 className="text-xl font-semibold text-white mb-4 border-b border-white/20 pb-2">
          Spacing Scale
        </h2>
        <div className="flex items-end gap-4">
          {[1, 2, 3, 4, 6, 8, 12, 16].map((n) => (
            <div key={n} className="text-center">
              <div
                className="bg-indigo-500"
                style={{ width: `${n * 4}px`, height: `${n * 4}px` }}
              />
              <span className="text-xs text-white/60 mt-1 block">{n}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={() => {
          setModalOpen(false);
          addToast('success', 'Action confirmed!');
        }}
        title="Confirm Action"
        message="Are you sure you want to proceed with this action? This cannot be undone."
        confirmText="Yes, proceed"
        cancelText="Cancel"
      />
    </div>
  );
}
