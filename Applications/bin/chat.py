#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.13"
# dependencies = [
#     "pyreadline3",
#     "requests",
#     "pillow",
#     "pyperclip",
#     "prompt_toolkit",
# ]
# ///

import os
import sys
import json
import argparse
import base64
import io
import platform

import readline
from PIL import Image
import requests
from prompt_toolkit import PromptSession
from prompt_toolkit.key_binding import KeyBindings
from prompt_toolkit.keys import Keys

# ANSI escape sequences for terminal text formatting
ITALIC = '\033[3m'
RESET = '\033[0m'

# Function to get the API key from environment variable
def get_api_key():
    api_key = os.getenv('DASHSCOPE_API_KEY')
    if not api_key:
        raise ValueError("DASHSCOPE_API_KEY not found in environment variables")
    return api_key

def parse_response(type, response):
    response_buffer = ""
    if type == "reason":
        print("---Start Reasoning---")
        reasoning_finished = False
    else:
        reasoning_finished = True

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
                        print("---Finish Reasoning---")
                        reasoning_finished = True
                    response_buffer += content
                    print(content, end='', flush=True)
    return response_buffer
    


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
            model = "qwen-max-0403"
        case 'vision':
            model = "qwen-vl-max-latest"
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

    response_str = ""

    # Sending the request with stream
    try:
        with requests.post(url, headers=headers, json=payload, stream=True) as response:
            if response.status_code != 200:
                print(f"Error: {response.status_code}")
                print(f"Message: {response.text}")
                return

            response_str = parse_response(type, response)
    except json.JSONDecodeError:
        # because the last response is not a valid json
        print()
    except KeyboardInterrupt:
        return response_str
    except Exception as e:
        print(f"Error processing response: {e}")

    return response_str

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

def get_clipboard_image_base64():
    """从剪贴板获取图片并转换为base64编码 (支持Windows和Linux)"""
    try:
        system = platform.system()
        
        if system == "Windows":
            # Windows平台使用PIL的ImageGrab
            from PIL import ImageGrab
            image = ImageGrab.grabclipboard()
            
            # 检查是否成功获取到图片
            if image is None or not isinstance(image, Image.Image):
                print("剪贴板中没有找到图片")
                return None
                
        elif system == "Linux":
            # Linux平台尝试使用xclip
            import subprocess
            try:
                # 检查xclip是否安装
                subprocess.run(["which", "xclip"], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                
                # 从剪贴板获取图片数据
                p = subprocess.Popen(['xclip', '-selection', 'clipboard', '-t', 'image/png', '-o'], 
                                    stdout=subprocess.PIPE)
                stdout, _ = p.communicate()
                
                if not stdout:
                    print("剪贴板中没有找到图片")
                    return None
                
                # 从二进制数据创建PIL图像
                image = Image.open(io.BytesIO(stdout))
            except subprocess.CalledProcessError:
                print("请安装xclip")
                return None
            except Exception as e:
                print(f"使用xclip获取剪贴板图片失败: {e}")
                return None
        
        elif system == "Darwin":  # macOS
            # macOS平台可以使用PIL的ImageGrab或pngpaste
            try:
                from PIL import ImageGrab
                image = ImageGrab.grabclipboard()
                
                if image is None or not isinstance(image, Image.Image):
                    # 如果PIL方法失败，尝试使用pngpaste
                    import subprocess
                    try:
                        # 检查pngpaste是否安装
                        subprocess.run(["which", "pngpaste"], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                        
                        # 创建临时文件
                        temp_file = "/tmp/clipboard_image.png"
                        subprocess.run(["pngpaste", temp_file], check=True)
                        
                        # 从文件加载图像
                        image = Image.open(temp_file)
                        # 用完后删除临时文件
                        os.remove(temp_file)
                    except subprocess.CalledProcessError:
                        print("请安装pngpaste: brew install pngpaste")
                        return None
            except Exception as e:
                print(f"从macOS剪贴板获取图片失败: {e}")
                return None
        else:
            print(f"不支持的操作系统: {system}")
            return None
            
        # 将图像转换为base64
        buffered = io.BytesIO()
        image.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
        return img_str
        
    except Exception as e:
        print(f"处理剪贴板图片时出错: {e}")
        return None

def get_multiline_input():
    """获取用户输入，支持多行粘贴，使用Ctrl+Enter提交"""
    # 创建键绑定
    kb = KeyBindings()
    
    # 绑定Ctrl+Enter键
    @kb.add("c-s")  
    def _(event):
        # 这会让 prompt 接受当前输入并返回
        event.current_buffer.validate_and_handle()
    
    # 创建会话
    session = PromptSession(key_bindings=kb, multiline=True)
    
    user_input = session.prompt("You: ", default="")
    return user_input if user_input is not None else ""


def parse_input(input: str):
    lines = input.split('\n')
    message_lines = []
    instructions = {}
    
    for line in lines:
        if line.startswith('@@'):
            # Process instruction line
            instruction = line[2:].strip()
            if instruction == 'tr':
                instructions['type'] = 'reason'
            elif instruction == 'ts':
                instructions['type'] = 'small'
            elif instruction == 'ic':
                instructions['image'] = 'clipboard'
            elif instruction.startswith('if'):
                # Get file path and convert to base64
                file_path = instruction[2:].strip()
                if file_path:
                    try:
                        with open(file_path, 'rb') as image_file:
                            base64_data = base64.b64encode(image_file.read()).decode('utf-8')
                            instructions['image'] = base64_data
                    except Exception as e:
                        print(f"Error reading image file: {e}")
        else:
            message_lines.append(line)
    
    message = '\n'.join(message_lines).strip()
    return message, instructions


def chat_loop(messages, message, user_message, pipeline):
    instructions = {}
    type = "normal"
    if message:
        user_message += message 
        message = ""
    else:
        input = get_multiline_input()
        message, instructions = parse_input(input)
        user_message += message
    if pipeline:
        pipeline = False
        user_message += get_input()

    # Add user message to the messages list
    if "image" in instructions:
        type = "vision"
        if instructions["image"] == "clipboard":
            base64_image = get_clipboard_image_base64()
        else:
            base64_image = instructions["image"]
        messages.append({
            "role": "user",
            "content": [{"type": "text", "text": user_message},
                        {"type": "image_url", "image_url": {
                            "url": f"data:image/png;base64,{base64_image}"
                            }}]
                            })
    else:
        messages.append({"role": "user", "content": user_message})

    if "type" in instructions:
        type = instructions["type"]
    print("Assistant: ", end='', flush=True)
    response = chat_stream(messages, type)  # Pass the updated messages list to the function

    messages.append({"role": "assistant", "content": response})
    user_message = ""

# Main interactive loop
def start_chat(type, message, pipeline, noninteractive, image):
    print("Welcome to the chat! Type ^D to exit the session.")
    messages = []  # Initialize the messages list
    user_message = "You are a helpful and knowledgeable assistant. I may ask you in English, but you should always answer in Chinese."
    while True:
        try:
            chat_loop(messages, message, user_message, pipeline)
        except KeyboardInterrupt:
            pass
        except EOFError:
            print("Bye!")
            break

def parse_args():
    parser = argparse.ArgumentParser(description="get args for llm")
    parser.add_argument("--type", "-t", default="normal", choices=["normal", "reason", "small", "vision"], help="language model type")
    parser.add_argument("--message", "-m", type=str, help="first message")
    parser.add_argument("--pipeline", "-p", action="store_true", help="input from pipeline")
    parser.add_argument("--noninteractive", "-n", action="store_true", help="non interactive mode")
    parser.add_argument("--image", "-i", action="store_true", help="image path")

    return parser.parse_args()


# Start the chat session
if __name__ == "__main__":
    args = parse_args()
    start_chat(args.type,
               args.message,
               args.pipeline,
               args.noninteractive,
               args.image)
