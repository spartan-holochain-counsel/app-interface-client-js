
import crypto				from 'crypto';

if ( global.crypto === undefined )
    global.crypto			= {};

if ( global.crypto.getRandomValues === undefined ) {
    global.crypto.getRandomValues	= ( arr ) => crypto.randomBytes( arr.length );
}

if ( global.crypto.subtle?.digest === undefined ) {
    if ( global.crypto.subtle === undefined )
	global.crypto.subtle		= {};

    global.crypto.subtle.digest		= ( _, bytes ) => {
	if ( bytes instanceof ArrayBuffer ) // Conversion needed for @noble/ed25519
	    bytes			= new Uint8Array( bytes );
	const hash			= crypto.createHash('sha512');
	hash.update( bytes );
	const digest			= hash.digest();
	return digest;
    };
}
else {
    const _digest			= global.crypto.subtle.digest;
    global.crypto.subtle.digest		= ( algorithm, bytes ) => {
	if ( bytes instanceof ArrayBuffer ) // Conversion needed for @noble/ed25519
	    bytes			= new Uint8Array( bytes );
	return _digest( algorithm, bytes );
    }
}

import DefaultExports			from './index.js';

export *				from './index.js';
export default DefaultExports;
