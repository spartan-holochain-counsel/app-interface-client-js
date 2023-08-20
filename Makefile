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
test:				test-integration	test-e2e
test-debug:			test-integration-debug	test-e2e-debug

test-integration:		build
	LOG_LEVEL=warn npx mocha $(MOCHA_OPTS) ./tests/integration
test-integration-debug:		build
	LOG_LEVEL=trace npx mocha $(MOCHA_OPTS) ./tests/integration
test-integration-debug-%:	build
	LOG_LEVEL=trace npx mocha $(MOCHA_OPTS) ./tests/integration/test_$*.js

test-e2e:		prepare-package build
	LOG_LEVEL=warn npx mocha $(MOCHA_OPTS) ./tests/e2e
test-e2e-debug:		prepare-package build
	LOG_LEVEL=trace npx mocha $(MOCHA_OPTS) ./tests/e2e
test-e2e-debug-%:	prepare-package build
	LOG_LEVEL=trace npx mocha $(MOCHA_OPTS) ./tests/e2e/test_$*.js

test-server:
	python3 -m http.server 8765


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
