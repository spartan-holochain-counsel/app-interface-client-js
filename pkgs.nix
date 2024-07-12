{ pkgs, system }:

import (pkgs.fetchFromGitHub {
  owner = "spartan-holochain-counsel";
  repo = "nix-overlay";
  rev = "f8535961730ed3a0cfe81dcf068e7da29b4f4e64";
  sha256 = "EoIiBDqiT8nAo7I60jjWzSlwBt+bTabXw0s87REX/3w=";
}) {
  inherit pkgs;
  inherit system;
}
