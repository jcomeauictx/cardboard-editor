#!/usr/bin/python3
'''
test that X is running and will display our windows
'''
import logging
import tkinter as tk
#from tkinter import ttk
logging.basicConfig(level=logging.DEBUG if __debug__ else logging.WARNING)
logging.debug('starting program')
window = tk.Tk()
logging.debug('window launched')
window.title('X test')
logging.debug('title set')
#label = tk.Label(window, text='X is running')
#logging.debug('label created')
#label.pack()
textarea = tk.Text(window, height=10, width=40)
textarea.pack()
logging.debug('starting mainloop')
window.mainloop()
