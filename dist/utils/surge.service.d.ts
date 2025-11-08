export declare class SurgeService {
    private surgeMultiplier;
    private surgeUntil;
    setSurge(multiplier: number, durationMinutes: number): void;
    getCurrentMultiplier(): number;
    isSurgeActive(): boolean | null;
}
