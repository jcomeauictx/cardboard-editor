#!/usr/bin/python3
'''
get profile data from chromium
'''
import sys, os, json  # pylint: disable=multiple-imports

STATEFILE = os.path.expanduser('~/.config/chromium/Local State')

def profile(filename=None, profilename='stopgap'):
    '''
    selects profile identifier by profile name
    '''
    # this idiom is preferred over `filename=STATEFILE` above because
    # it allows to leave a blank arg for filename at commandline
    # e.g. `./profile.py '' stopgap`
    filename = filename if filename else STATEFILE
    try:
        with open(filename, 'r', encoding='utf-8') as infile:
            profiles = json.load(infile)['profile']['info_cache']
    except FileNotFoundError:
        profiles = {}
    selected = [
        profile for profile in profiles
        if profiles[profile]['name'] == profilename
    ]
    return selected[0] if len(selected) == 1 else None

if __name__ == '__main__':
    print(profile(*sys.argv[1:]))
