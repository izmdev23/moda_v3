import { AppAlertButton, AppAlertRequest, setAppAlertPresenter } from '@/utils/app-alert';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ModaAlertModal } from './moda-alert-modal';

interface AppAlertProviderProps {
    readonly children: React.ReactNode;
}

interface QueueItem extends AppAlertRequest {
    readonly id: number;
}

const EMPTY_MESSAGE = '';
const DEFAULT_BUTTON_LABEL = 'OK';

interface ResolvedActions {
    readonly positive: AppAlertButton;
    readonly negative?: AppAlertButton;
}

function resolveActions(buttons: readonly AppAlertButton[] | undefined): ResolvedActions {
    const normalizedButtons = buttons !== undefined && buttons.length > 0
        ? [...buttons]
        : [{ text: DEFAULT_BUTTON_LABEL }];

    if (normalizedButtons.length === 1) {
        return {
            positive: normalizedButtons[0],
        };
    }

    const cancelButton = normalizedButtons.find((button) => button.style === 'cancel');
    const negativeButton = cancelButton ?? normalizedButtons[0];
    const positiveCandidates = normalizedButtons.filter((button) => button !== negativeButton);

    const destructiveButton = positiveCandidates.find((button) => button.style === 'destructive');
    const fallbackPositive = positiveCandidates.length > 0
        ? positiveCandidates[positiveCandidates.length - 1]
        : normalizedButtons[normalizedButtons.length - 1];

    return {
        positive: destructiveButton ?? fallbackPositive,
        negative: negativeButton,
    };
}

function runButtonCallback(button: AppAlertButton | undefined): void {
    if (button?.onPress === undefined) {
        return;
    }

    try {
        button.onPress();
    } catch (error: unknown) {
        console.error('[AppAlert] Button callback failed:', error);
    }
}

/**
 * App-level custom alert presenter. Converts imperative AppAlert calls
 * into a themed modal queue rendered at the root of the app.
 */
export function AppAlertProvider({ children }: AppAlertProviderProps): React.JSX.Element {
    const idRef = useRef<number>(1);
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [activeAlert, setActiveAlert] = useState<QueueItem | null>(null);

    const enqueueAlert = useCallback((request: AppAlertRequest): void => {
        setQueue((previousQueue) => {
            const nextId = idRef.current;
            idRef.current += 1;

            return [...previousQueue, { ...request, id: nextId }];
        });
    }, []);

    useEffect((): (() => void) => {
        setAppAlertPresenter(enqueueAlert);

        return (): void => {
            setAppAlertPresenter(null);
        };
    }, [enqueueAlert]);

    useEffect((): void => {
        if (activeAlert !== null || queue.length === 0) {
            return;
        }

        const [nextAlert, ...remainingAlerts] = queue;
        setQueue(remainingAlerts);
        setActiveAlert(nextAlert);
    }, [activeAlert, queue]);

    const resolvedActions = useMemo<ResolvedActions>(() => resolveActions(activeAlert?.buttons), [activeAlert?.buttons]);

    const closeActiveAlert = useCallback((): void => {
        setActiveAlert(null);
    }, []);

    const handlePositivePress = useCallback((): void => {
        const positiveButton = resolvedActions.positive;
        closeActiveAlert();
        runButtonCallback(positiveButton);
    }, [closeActiveAlert, resolvedActions.positive]);

    const handleNegativePress = useCallback((): void => {
        const negativeButton = resolvedActions.negative;
        closeActiveAlert();
        runButtonCallback(negativeButton);
    }, [closeActiveAlert, resolvedActions.negative]);

    const handleRequestClose = useCallback((): void => {
        if (resolvedActions.negative !== undefined) {
            handleNegativePress();
            return;
        }

        closeActiveAlert();
        if (activeAlert?.options?.onDismiss !== undefined) {
            activeAlert.options.onDismiss();
        }
    }, [activeAlert?.options, closeActiveAlert, handleNegativePress, resolvedActions.negative]);

    return (
        <>
            {children}
            <ModaAlertModal
                visible={activeAlert !== null}
                title={activeAlert?.title ?? EMPTY_MESSAGE}
                message={activeAlert?.message ?? EMPTY_MESSAGE}
                positiveLabel={resolvedActions.positive.text ?? DEFAULT_BUTTON_LABEL}
                negativeLabel={resolvedActions.negative?.text}
                onPositivePress={handlePositivePress}
                onNegativePress={resolvedActions.negative !== undefined ? handleNegativePress : undefined}
                onRequestClose={handleRequestClose}
            />
        </>
    );
}
