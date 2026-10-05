import React from 'react';
import {test,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import ExportReview from '../src/ExportReview.jsx';
afterEach(cleanup);
test('blank photo warning offers review and still allows optional blank fields to be exported',()=>{
 Element.prototype.scrollIntoView=()=>{};
 const review=vi.fn(),download=vi.fn();
 render(<ExportReview summary={{blank:1,unchecked:1,pending:0}} onReview={review} onExport={download} onClose={()=>{}}/>);
 expect(screen.getByRole('alert').textContent).toContain('no name, date or amount');
 expect(download).not.toHaveBeenCalled();fireEvent.click(screen.getByText('Review photo details'));expect(review).toHaveBeenCalledOnce();
 fireEvent.click(screen.getByText('Export current values anyway'));expect(download).toHaveBeenCalledOnce();
});
