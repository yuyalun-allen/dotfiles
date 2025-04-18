#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.13"
# dependencies = [
#     "requests",
# ]
# ///

import os
import sys
import json
import argparse
import readline

import requests

# ANSI escape sequences for terminal text formatting
ITALIC = '\033[3m'
RESET = '\033[0m'

# Function to get the API key from environment variable
def get_api_key():
    api_key = os.getenv('DASHSCOPE_API_KEY')
    if not api_key:
        raise ValueError("DASHSCOPE_API_KEY not found in environment variables")
    return api_key

# Function to send the request and stream the response
def chat_stream(messages, type):
    url = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {get_api_key()}",
        "Content-Type": "application/json"
    }

    model = ""
    match type:
        case 'normal':
            model = "deepseek-v3"
        case 'reason':
            model = "deepseek-r1"
        case 'small':
            model = "qwen2.5-vl-3b-instruct"
        case _:
            raise ValueError("Unsupported type!")

    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
        "stream_options": {
            "include_usage": True
        }
    }

    # Sending the request with stream
    with requests.post(url, headers=headers, json=payload, stream=True) as response:
        if response.status_code != 200:
            print(f"Error: {response.status_code}")
            return

        response_buffer = ''
        if type == "reason":
            reasoning_finished = False
        else:
            reasoning_finished = True

        try:
            for line in response.iter_lines():
                if line:
                    # Remove 'data: ' prefix and try to load the JSON response
                    line = line.decode('utf-8').replace('data: ', '')
                    data = json.loads(line)

                    # Check if 'choices' key exists and has data
                    if 'choices' in data and len(data['choices']) > 0:
                        delta = data['choices'][0]['delta']

                        # Check for reasoning_content and content
                        reasoning_content = delta.get('reasoning_content', '')
                        content = delta.get('content', '')

                        # Append reasoning_content to the session
                        if reasoning_content:
                            print(f"{ITALIC}{reasoning_content}{RESET}", end='', flush=True)

                        # Append content to the session once available
                        if content:
                            if not reasoning_finished:
                                print("\n")
                                reasoning_finished = True
                            response_buffer += content
                            print(content, end='', flush=True)

        except json.JSONDecodeError:
            # because the last response is not a valid json
            print()
        except KeyboardInterrupt:
            if reasoning_content:
                return response_buffer
            else:
                return reasoning_content
        except Exception as e:
            print(f"Error processing response: {e}")

        return response_buffer

def get_input():
    user_message = sys.stdin.read().strip()
    # 重建 stdin
    if sys.platform == "win32":
        tty_path = 'CONIN$'  # Windows控制台输入
    else:
        tty_path = '/dev/tty'  # 类Unix终端
    # 打开终端设备并复制描述符到stdin
    tty_fd = os.open(tty_path, os.O_RDWR)
    os.dup2(tty_fd, sys.stdin.fileno())
    os.close(tty_fd)
    sys.stdin = os.fdopen(sys.stdin.fileno(), 'r')

    return user_message

# Main interactive loop
def start_chat(type, message, pipeline, noninteractive):
    print("Welcome to the chat! Type ^D to exit the session.")
    messages = []  # Initialize the messages list
    user_message = "You are a helpful and knowledgeable assistant. I may ask you in English, but you should always answer in Chinese."
    while True:
        if message:
            user_message += message 
            message = ""
        else:
            try:
                user_message += input("You: ")
            except KeyboardInterrupt:
                pass
            except EOFError:
                print("Bye!")
                break
        if pipeline:
            pipeline = False
            user_message += get_input()

        # Add user message to the messages list
        messages.append({"role": "user", "content": user_message})

        print("Assistant: ", end='', flush=True)
        response = chat_stream(messages, type)  # Pass the updated messages list to the function
        if noninteractive:
            break

        messages.append({"role": "assistant", "content": response})
        user_message = ""

def parse_args():
    parser = argparse.ArgumentParser(description="get args for llm")
    parser.add_argument("--type", "-t", default="normal", choices=["normal", "reason", "small"], help="language model type")
    parser.add_argument("--message", "-m", type=str, help="first message")
    parser.add_argument("--pipeline", "-p", action="store_true", help="input from pipeline")
    parser.add_argument("--noninteractive", "-n", action="store_true", help="non interactive mode")

    return parser.parse_args()


# Start the chat session
if __name__ == "__main__":
    args = parse_args()
    start_chat(args.type, args.message, args.pipeline, args.noninteractive)
