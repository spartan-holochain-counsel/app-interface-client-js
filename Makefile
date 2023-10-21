.PHONY:			FORCE

#
# Project
#
package-lock.json:	package.json
	npm install
	touch $@
node_modules:		package-lock.json
	npm install
	touch $@
build:			node_modules

use-local-holo-hash:
	cd tests; npm uninstall @spartan-hc/holo-hash
	cd tests; npm install --save ../../holo-hash-js/
use-npm-holo-hash:
	cd tests; npm uninstall @spartan-hc/holo-hash
	cd tests; npm install --save @spartan-hc/holo-hash

use-local-serialization:
	cd tests; npm uninstall @spartan-hc/holochain-serialization
	cd tests; npm install --save ../../holochain-serialization-js/
use-npm-serialization:
	cd tests; npm uninstall @spartan-hc/holochain-serialization
	cd tests; npm install --save @spartan-hc/holochain-serialization

use-local-websocket:
	cd tests; npm uninstall @spartan-hc/holochain-websocket
	cd tests; npm install --save ../../holochain-websocket-js/
use-npm-websocket:
	cd tests; npm uninstall @spartan-hc/holochain-websocket
	cd tests; npm install --save @spartan-hc/holochain-websocket

use-local-admin-client:
	cd tests; npm uninstall @spartan-hc/holochain-admin-client
	cd tests; npm install --save-dev ../../holochain-admin-client-js/
use-npm-admin-client:
	cd tests; npm uninstall @spartan-hc/holochain-admin-client
	cd tests; npm install --save-dev @spartan-hc/holochain-admin-client

use-local-backdrop:
	cd tests; npm uninstall @spartan-hc/holochain-backdrop
	cd tests; npm install --save-dev ../../node-holochain-backdrop/
use-npm-backdrop:
	cd tests; npm uninstall @spartan-hc/holochain-backdrop
	cd tests; npm install --save-dev @spartan-hc/holochain-backdrop


MOCHA_OPTS		= -t 15000
#
# Testing
#
CONTENT_DNA			= tests/content_dna.dna
TEST_DNAS			= $(CONTENT_DNA)

tests/%.dna:			FORCE
	cd tests; make $*.dna
test:				test-unit	test-integration
test-debug:			test-unit-debug	test-integration-debug

test-unit:		build
	LOG_LEVEL=fatal npx mocha $(MOCHA_OPTS) ./tests/unit
test-unit-debug:	build
	LOG_LEVEL=trace npx mocha $(MOCHA_OPTS) ./tests/unit

test-integration:		build $(CONTENT_DNA)
	LOG_LEVEL=fatal npx mocha $(MOCHA_OPTS) ./tests/integration
test-integration-debug:		build $(CONTENT_DNA)
	LOG_LEVEL=trace npx mocha $(MOCHA_OPTS) ./tests/integration



#
# Repository
#
clean-remove-chaff:
	@find . -name '*~' -exec rm {} \;
clean-files:		clean-remove-chaff
	git clean -nd
clean-files-force:	clean-remove-chaff
	git clean -fd
clean-files-all:	clean-remove-chaff
	git clean -ndx
clean-files-all-force:	clean-remove-chaff
	git clean -fdx



#
# NPM packaging
#
prepare-package:
	rm -f dist/*
	npx webpack
	MODE=production npx webpack
	gzip -kf dist/*.js
preview-package:	clean-files test prepare-package
	npm pack --dry-run .
create-package:		clean-files test prepare-package
	npm pack .
publish-package:	clean-files test prepare-package
	npm publish --access public .
