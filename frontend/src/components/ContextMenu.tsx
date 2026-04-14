import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  children: React.ReactNode;
  trigger?: 'context' | 'click';
  portalTarget?: HTMLElement | null;
}

interface MenuState {
  visible: boolean;
  x: number;
  y: number;
}

export function ContextMenu({ items, children, trigger = 'context', portalTarget }: ContextMenuProps) {
  const [menu, setMenu] = useState<MenuState>({ visible: false, x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const openMenu = useCallback((clientX: number, clientY: number) => {
    const menuWidth = 220;
    const menuHeight = items.length * 38 + 24;

    const x = clientX + menuWidth > window.innerWidth
      ? clientX - menuWidth
      : clientX;
    const y = clientY + menuHeight > window.innerHeight
      ? Math.max(8, clientY - menuHeight)
      : Math.max(8, clientY);

    setMenu({ visible: true, x: Math.max(8, x), y });
  }, [items.length]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openMenu(e.clientX, e.clientY);
  }, [openMenu]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const target = (e.currentTarget as HTMLElement).querySelector('button, [role="button"]') || e.currentTarget;
    const rect = target.getBoundingClientRect();
    if (rect.width > 0) {
      openMenu(rect.right, rect.bottom);
    } else {
      openMenu(e.clientX, e.clientY);
    }
  }, [openMenu]);

  const handleClose = useCallback(() => {
    setMenu(prev => prev.visible ? { ...prev, visible: false } : prev);
  }, []);

  useEffect(() => {
    if (!menu.visible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        handleClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };

    const handleScroll = () => {
      handleClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [menu.visible, handleClose]);

  const handleItemClick = (item: ContextMenuItem) => {
    if (!item.disabled) {
      item.onClick();
      handleClose();
    }
  };

  const menuContent = menu.visible ? (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 2147483646 }}
        onClick={handleClose}
        onContextMenu={(e) => { e.preventDefault(); handleClose(); }}
      />
      <div
        ref={menuRef}
        style={{
          position: 'fixed',
          zIndex: 2147483647,
          left: menu.x,
          top: menu.y,
          minWidth: 200,
          maxWidth: 280,
          backgroundColor: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 12,
          boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
          overflow: 'hidden',
          animation: 'slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div style={{ padding: '4px 0' }}>
          {items.map((item, idx) => (
            <div key={idx}>
              {item.divider && idx > 0 && (
                <div style={{ height: 1, backgroundColor: 'hsl(var(--border))', margin: '4px 8px' }} />
              )}
              <button
                onClick={() => handleItemClick(item)}
                disabled={item.disabled}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '7px 12px',
                  fontSize: 13,
                  textAlign: 'left',
                  border: 'none',
                  background: 'none',
                  cursor: item.disabled ? 'not-allowed' : 'pointer',
                  color: item.disabled ? 'hsl(var(--muted-foreground))' : item.danger ? '#f87171' : 'hsl(var(--popover-foreground))',
                }}
                onMouseEnter={(e) => { if (!item.disabled) e.currentTarget.style.backgroundColor = item.danger ? 'rgba(239,68,68,0.1)' : 'hsl(var(--accent))'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
              >
                <span style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: item.danger ? '#f87171' : 'hsl(var(--muted-foreground))' }}>
                  {item.icon}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  ) : null;

  return (
    <>
      <div
        ref={triggerRef}
        onContextMenu={handleContextMenu}
        onClick={trigger === 'click' ? handleClick : undefined}
      >
        {children}
      </div>

      {menuContent && createPortal(menuContent, portalTarget || document.body)}
    </>
  );
}
