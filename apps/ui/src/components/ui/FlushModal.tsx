/**
 * FlushModal - Modal for cache flush with type selection
 */

import { useState } from 'react';
import { GlassCard } from './GlassCard';
import { Button } from './Button';
import { Input } from './Input';

export interface FlushModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFlush: (type: 'all' | 'zone' | 'request', value?: string) => Promise<void>;
  loading?: boolean;
}

export function FlushModal({ isOpen, onClose, onFlush, loading = false }: FlushModalProps) {
  const [flushType, setFlushType] = useState<'all' | 'zone' | 'request'>('all');
  const [value, setValue] = useState('');

  const handleFlush = async () => {
    await onFlush(flushType, flushType === 'all' ? undefined : value);
    onClose();
    setValue('');
    setFlushType('all');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <GlassCard variant="elevated" padding="lg" className="w-full max-w-md">
        <h2 className="text-xl font-bold text-white mb-4">Flush DNS Cache</h2>

        {/* Flush Type Selection */}
        <div className="space-y-3 mb-6">
          <label className="flex items-center gap-3 p-3 rounded-xl bg-white/5 cursor-pointer hover:bg-white/10 transition-colors">
            <input
              type="radio"
              name="flushType"
              value="all"
              checked={flushType === 'all'}
              onChange={() => setFlushType('all')}
              className="w-4 h-4 text-indigo-500"
            />
            <div>
              <div className="text-white font-medium">Flush All</div>
              <div className="text-white/50 text-sm">Clear entire DNS cache</div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-xl bg-white/5 cursor-pointer hover:bg-white/10 transition-colors">
            <input
              type="radio"
              name="flushType"
              value="zone"
              checked={flushType === 'zone'}
              onChange={() => setFlushType('zone')}
              className="w-4 h-4 text-indigo-500"
            />
            <div>
              <div className="text-white font-medium">Flush Zone</div>
              <div className="text-white/50 text-sm">Clear cache for a specific domain</div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-xl bg-white/5 cursor-pointer hover:bg-white/10 transition-colors">
            <input
              type="radio"
              name="flushType"
              value="request"
              checked={flushType === 'request'}
              onChange={() => setFlushType('request')}
              className="w-4 h-4 text-indigo-500"
            />
            <div>
              <div className="text-white font-medium">Flush Request</div>
              <div className="text-white/50 text-sm">Clear specific record type</div>
            </div>
          </label>
        </div>

        {/* Value Input (for zone/request) */}
        {flushType !== 'all' && (
          <div className="mb-6">
            <Input
              label={flushType === 'zone' ? 'Domain Name' : 'Request Type'}
              placeholder={flushType === 'zone' ? 'example.com' : 'A example.com'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              hint={flushType === 'zone' 
                ? 'Enter domain to flush (e.g., example.com)' 
                : 'Format: TYPE NAME (e.g., A example.com)'
              }
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleFlush}
            loading={loading}
            disabled={flushType !== 'all' && !value.trim()}
          >
            🗑️ Flush Cache
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}

export default FlushModal;
