import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export interface TabItem {
  id: string;
  label: string;
  badge?: string | number;
  icon?: ReactNode;
  disabled?: boolean;
  content: ReactNode;
}

export interface TabsProps {
  label: string;
  items: TabItem[];
  activeId?: string;
  defaultActiveId?: string;
  onChange?: (nextId: string) => void;
  /**
   * 'automatic': Left/Right activates immediately (lightweight panels).
   * 'activation': Left/Right moves focus; Enter/Space/click activates (heavy data panels).
   */
  selectionMode?: 'automatic' | 'activation';
  className?: string;
  testIdPrefix?: string;
}

export function Tabs({
  label,
  items,
  activeId,
  defaultActiveId,
  onChange,
  selectionMode = 'automatic',
  className = '',
  testIdPrefix = 'hr-tab',
}: TabsProps) {
  const baseId = useId();
  const [internalId, setInternalId] = useState<string>(
    defaultActiveId ?? items[0]?.id ?? '',
  );
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectedId = activeId ?? internalId ?? items[0]?.id ?? '';

  const selectTab = (nextId: string) => {
    if (activeId === undefined) {
      setInternalId(nextId);
    }
    onChange?.(nextId);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    const enabledIndices = items
      .map((item, idx) => (!item.disabled ? idx : -1))
      .filter((idx) => idx >= 0);

    if (enabledIndices.length === 0) return;

    const currentPos = enabledIndices.indexOf(currentIndex);
    let targetIndex: number | null = null;

    if (event.key === 'ArrowRight') {
      targetIndex = enabledIndices[(currentPos + 1) % enabledIndices.length];
    } else if (event.key === 'ArrowLeft') {
      targetIndex =
        enabledIndices[(currentPos - 1 + enabledIndices.length) % enabledIndices.length];
    } else if (event.key === 'Home') {
      targetIndex = enabledIndices[0];
    } else if (event.key === 'End') {
      targetIndex = enabledIndices[enabledIndices.length - 1];
    }

    if (targetIndex === null) return;

    event.preventDefault();
    const targetItem = items[targetIndex];
    tabRefs.current[targetIndex]?.focus();
    if (selectionMode === 'automatic' && targetItem && !targetItem.disabled) {
      selectTab(targetItem.id);
    }
  };

  return (
    <div className={['hr-tabs', className].filter(Boolean).join(' ')}>
      <div role="tablist" aria-label={label} className="hr-tabs__list">
        {items.map((item, index) => {
          const isSelected = item.id === selectedId;
          const tabId = `${baseId}-tab-${item.id}`;

          return (
            <button
              key={item.id}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              id={tabId}
              type="button"
              role="tab"
              aria-selected={isSelected}
              tabIndex={isSelected ? 0 : -1}
              disabled={item.disabled}
              className="hr-tabs__tab"
              data-testid={`${testIdPrefix}-${item.id}`}
              onClick={() => {
                if (!item.disabled) {
                  selectTab(item.id);
                }
              }}
              onKeyDown={(e) => handleKeyDown(e, index)}
            >
              {item.icon ? (
                <span className="hr-tabs__icon" aria-hidden="true">
                  {item.icon}
                </span>
              ) : null}
              <span>{item.label}</span>
              {item.badge !== undefined ? (
                <span className="hr-tabs__badge">{item.badge}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {items.map((item) => {
        const isSelected = item.id === selectedId;
        const tabId = `${baseId}-tab-${item.id}`;

        return (
          <div
            key={item.id}
            role="tabpanel"
            aria-labelledby={tabId}
            tabIndex={0}
            hidden={!isSelected}
            data-testid={`${testIdPrefix}-panel-${item.id}`}
          >
            {isSelected ? <div className="hr-tabs__panel-inner">{item.content}</div> : null}
          </div>
        );
      })}
    </div>
  );
}
