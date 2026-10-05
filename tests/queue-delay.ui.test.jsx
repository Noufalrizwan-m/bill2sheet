import {test,expect,vi} from 'vitest';
import {waitBetweenPhotos} from '../src/queue-delay.js';
test('voucher spacing waits 2–3 seconds',async()=>{
 vi.useFakeTimers();vi.spyOn(Math,'random').mockReturnValue(0.5);
 try{let done=false;const task=waitBetweenPhotos().then(()=>{done=true;});await vi.advanceTimersByTimeAsync(2499);expect(done).toBe(false);await vi.advanceTimersByTimeAsync(1);await task;expect(done).toBe(true);}
 finally{vi.useRealTimers();vi.restoreAllMocks();}
});
