import {
    HoloHash,
}					from '@spartan-hc/holo-hash';


export class HoloHashMap extends Map {
    set ( hash, value ) {
	if ( typeof hash !== "string" )
	    hash			= String(new HoloHash( hash ));

	return super.set( hash, value );
    }

    get ( hash ) {
	if ( typeof hash !== "string" )
	    hash			= String(new HoloHash( hash ));

	return super.get( hash );
    }
};


export default {
    HoloHashMap,
};
