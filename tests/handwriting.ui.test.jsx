import React from 'react';
import {test,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import HandwritingReview from '../src/HandwritingReview.jsx';
afterEach(cleanup);
test('suggestions require explicit confirmation, malformed numbers cannot be copied',()=>{
 const onUse=vi.fn();render(<HandwritingReview bill={{handwriting_suggestions:{vendor:'Gras Both Camp',total:'( 7 2S.'}}} onUse={onUse}/>);
 expect(onUse).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('Handwritten field'),{target:{value:'total'}});
 fireEvent.click(screen.getByText('Use checked text'));expect(onUse).not.toHaveBeenCalled();
 expect(screen.getByRole('alert').textContent).toMatch(/Correct the amount/);
 fireEvent.change(screen.getByLabelText('Handwriting suggestion'),{target:{value:'1725'}});
 fireEvent.click(screen.getByText('Use checked text'));expect(onUse).toHaveBeenCalledWith('total',1725);
});
